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
    // Verify user is authenticated
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }

    // Check if user is super admin from public.users table
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (adminError || !adminData || adminData.role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden - Not a super admin' });
    }

    const { requestId, passwordHash } = req.body;

    if (!requestId) {
      return res.status(400).json({ error: 'requestId is required' });
    }

    if (!passwordHash || passwordHash.trim() === '') {
      return res.status(400).json({ error: 'passwordHash is required' });
    }

    console.log('Processing approval for request:', requestId);

    // Get request details
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

    // Check if username already exists in users table
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, username')
      .eq('username', requestData.username_desired)
      .single();

    if (existingUser) {
      return res.status(400).json({ 
        error: 'Username already exists',
        username: existingUser.username 
      });
    }

    // Insert into public.users table with provided password hash (ALREADY HASHED FROM FRONTEND)
    const { error: userInsertError } = await supabaseAdmin
      .from('users')
      .insert({
        username: requestData.username_desired,
        password_hash: passwordHash, // Password sudah di-hash dari frontend
        full_name: requestData.nama_lengkap,
        email: requestData.email,
        no_hp: requestData.no_hp,
        role: 'admin',
        npsn: requestData.npsn,
        is_active: true,
        is_verified: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: user.id
      });

    if (userInsertError) {
      console.error('Error creating user record:', userInsertError);
      return res.status(500).json({ 
        error: 'Failed to create user record',
        details: userInsertError.message 
      });
    }

    console.log('User created successfully');

    // Check if school exists
    const { data: schoolData } = await supabaseAdmin
      .from('schools')
      .select('npsn')
      .eq('npsn', requestData.npsn)
      .single();

    if (!schoolData) {
      // Create school record with same password hash
      const { error: schoolInsertError } = await supabaseAdmin
        .from('schools')
        .insert({
          npsn: requestData.npsn,
          nama_sekolah: requestData.nama_sekolah,
          password_hash: passwordHash, // Password sudah di-hash dari frontend
          is_active: true,
          created_at: new Date().toISOString()
        });

      if (schoolInsertError) {
        console.error('Error creating school record:', schoolInsertError);
      } else {
        console.log('School created successfully');
      }
    }

    // Update admin_requests status to approved
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
      return res.status(500).json({ error: 'Failed to update request status' });
    }

    console.log('Request approved successfully');

    return res.status(200).json({ 
      success: true, 
      message: 'Admin approved successfully',
      username: requestData.username_desired,
      email: requestData.email,
      npsn: requestData.npsn
      // Tidak mengembalikan defaultPassword karena password sudah diinput di frontend
    });
  } catch (error) {
    console.error('Error in approve-request API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};