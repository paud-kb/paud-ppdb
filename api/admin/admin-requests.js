const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing required environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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
      console.log('Auth error:', authError);
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }

    console.log('User ID:', user.id);

    // Check if user is super admin from public.users table
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('users')
      .select('role, username, full_name, email')
      .eq('id', user.id)
      .single();

    console.log('Admin data:', adminData);
    console.log('Admin error:', adminError);

    if (adminError || !adminData) {
      console.log('User not found in public.users');
      return res.status(403).json({ error: 'Forbidden - User not found' });
    }

    if (adminData.role !== 'super_admin') {
      console.log('User is not super admin. Role:', adminData.role);
      return res.status(403).json({ error: 'Forbidden - Not a super admin' });
    }

    console.log('Super admin verified:', adminData.username);

    if (req.method === 'GET') {
      // Get all admin requests using service role (bypasses RLS)
      const { data, error } = await supabaseAdmin
        .from('admin_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching admin requests:', error);
        return res.status(500).json({ error: 'Failed to fetch admin requests' });
      }

      return res.status(200).json({ requests: data });
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in admin-requests API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};