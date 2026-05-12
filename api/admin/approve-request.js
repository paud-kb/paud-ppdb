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
    // Verify user is authenticated and is super admin
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }

    // Check if user is super admin
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('admins')
      .select('role')
      .eq('id', user.id)
      .single();

    if (adminError || !adminData || adminData.role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden - Not a super admin' });
    }

    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({ error: 'requestId is required' });
    }

    // Get the request details
    const { data: requestData, error: requestError } = await supabaseAdmin
      .from('admin_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (requestError || !requestData) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (requestData.status !== 'pending') {
      return res.status(400).json({ error: 'Request has already been processed' });
    }

    // Create admin user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: requestData.email,
      password: generatePassword(12),
      email_confirm: true,
      user_metadata: {
        nama_lengkap: requestData.nama_lengkap,
        npsn: requestData.npsn,
        no_hp: requestData.no_hp,
        role: 'admin'
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return res.status(500).json({ error: 'Failed to create admin user' });
    }

    // Create admin record in admins table
    const { error: adminInsertError } = await supabaseAdmin
      .from('admins')
      .insert({
        id: authData.user.id,
        email: requestData.email,
        nama_lengkap: requestData.nama_lengkap,
        npsn: requestData.npsn,
        no_hp: requestData.no_hp,
        username: requestData.username_desired,
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (adminInsertError) {
      console.error('Error creating admin record:', adminInsertError);
      // Rollback: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: 'Failed to create admin record' });
    }

    // Update the admin_requests status
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

    return res.status(200).json({ 
      success: true, 
      message: 'Admin approved successfully',
      adminId: authData.user.id
    });
  } catch (error) {
    console.error('Error in approve-request API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

function generatePassword(length) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}