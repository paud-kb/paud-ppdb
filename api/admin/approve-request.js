const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing required environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. AUTHENTICATION CHECK
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }

    // Check super admin role
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (adminError || !adminData || adminData.role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden - Not a super admin' });
    }

    const { requestId, passwordHash } = req.body;

    if (!requestId || !passwordHash) {
      return res.status(400).json({ error: 'Missing requestId or passwordHash' });
    }

    console.log('Processing approval for request:', requestId);

    // 2. FETCH REQUEST DATA
    const { data: requestData, error: requestError } = await supabaseAdmin
      .from('admin_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (requestError || !requestData) {
      console.error('Request not found:', requestError);
      return res.status(404).json({ error: 'Request not found' });
    }

    if (requestData.status !== 'pending') {
      return res.status(400).json({ error: 'Request has already been processed' });
    }

    // ==========================================
    // 3. PRE-CHECKS (Unikness)
    // ==========================================

    // Check Username unik di tabel users
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('username', requestData.username_desired)
      .single();

    if (existingUser) {
      return res.status(400).json({ 
        error: 'Username already exists in system',
        username: requestData.username_desired 
      });
    }

    // Check NPSN di tabel users (Constraint: users_npsn_unique)
    // Karena satu sekolah hanya boleh punya 1 admin (berdasarkan unique key)
    const { data: existingSchoolUser } = await supabaseAdmin
      .from('users')
      .select('id, npsn')
      .eq('npsn', requestData.npsn)
      .single();

    if (existingSchoolUser) {
      return res.status(400).json({ 
        error: 'School (NPSN) already has an admin account',
        npsn: requestData.npsn 
      });
    }

    // ==========================================
    // 4. CREATE SCHOOL (Wajib Duluan karena Foreign Key)
    // ==========================================
    const { data: schoolData, error: schoolCheckError } = await supabaseAdmin
      .from('schools')
      .select('*')
      .eq('npsn', requestData.npsn)
      .single();

    let isSchoolNew = false;

    if (!schoolData && schoolCheckError?.code === 'PGRST116') {
      // Sekolah belum ada, buat baru
      console.log('Creating new school for NPSN:', requestData.npsn);
      const { error: schoolInsertError } = await supabaseAdmin
        .from('schools')
        .insert([{
          npsn: requestData.npsn,
          nama_sekolah: requestData.nama_sekolah,
          password_hash: passwordHash, // Password sama dengan admin
          is_active: true
        }]);

      if (schoolInsertError) {
        console.error('Error creating school:', schoolInsertError);
        return res.status(500).json({ error: 'Failed to create school', details: schoolInsertError.message });
      }
      isSchoolNew = true;
    } else if (schoolCheckError) {
      console.error('Error checking school:', schoolCheckError);
      return res.status(500).json({ error: 'Database error checking school' });
    } else {
      console.log('School already exists for NPSN:', requestData.npsn);
    }

    // ==========================================
    // 5. CREATE USER (Baru bisa dilakukan setelah School ada)
    // ==========================================
    console.log('Creating user...');
    const { error: userInsertError } = await supabaseAdmin
      .from('users')
      .insert([{
        username: requestData.username_desired,
        password_hash: passwordHash,
        full_name: requestData.nama_lengkap, // Map ke kolom database
        email: requestData.email,
        no_hp: requestData.no_hp,
        role: 'admin',
        npsn: requestData.npsn, // Wajib ada karena FK
        is_active: true,
        is_verified: false,
        created_by: user.id
        // created_at & updated_at akan auto generate dari database default
      }]);

    if (userInsertError) {
      console.error('Error creating user (Full Details):', userInsertError);
      return res.status(500).json({ 
        error: 'Failed to create user record',
        details: userInsertError.message,
        hint: userInsertError.hint 
      });
    }

    console.log('User created successfully');

    // ==========================================
    // 6. UPDATE REQUEST STATUS
    // ==========================================
    const { error: updateError } = await supabaseAdmin
      .from('admin_requests')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('Error updating request status:', updateError);
      // Jangan return error 500 jika user berhasil dibuat, tapi log error saja
      // Atau jika ingin strict, bisa return 500 di sini
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Admin approved successfully',
      school_created: isSchoolNew,
      npsn: requestData.npsn
    });

  } catch (error) {
    console.error('Error in approve-request API:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};