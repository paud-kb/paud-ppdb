const { createClient } = require('@supabase/supabase-js');

// Validate environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Environment check:', {
  hasSupabaseUrl: !!supabaseUrl,
  supabaseUrlType: typeof supabaseUrl,
  hasSupabaseKey: !!supabaseKey,
  supabaseKeyType: typeof supabaseKey
});

if (!supabaseUrl || typeof supabaseUrl !== 'string') {
  throw new Error('SUPABASE_URL environment variable is missing or invalid');
}

if (!supabaseKey || typeof supabaseKey !== 'string') {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is missing or invalid');
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

    if (req.method === 'GET') {
      // Get all admin requests
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