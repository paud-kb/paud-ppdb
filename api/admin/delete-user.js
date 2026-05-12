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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'DELETE') {
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
      console.log('Auth error:', authError);
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }

    console.log('Current user ID:', user.id);

    // Check if user is super admin from public.users table
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('users')
      .select('role, username, full_name')
      .eq('id', user.id)
      .single();

    console.log('Admin data:', adminData);

    if (adminError || !adminData) {
      console.log('User not found in public.users');
      return res.status(403).json({ error: 'Forbidden - User not found' });
    }

    if (adminData.role !== 'super_admin') {
      console.log('User is not super admin. Role:', adminData.role);
      return res.status(403).json({ error: 'Forbidden - Not a super admin' });
    }

    console.log('Super admin verified:', adminData.username);

    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Prevent super admin from deleting themselves
    if (userId === user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    // Get user info before deletion for logging
    const { data: targetUser } = await supabaseAdmin
      .from('users')
      .select('username, full_name, email')
      .eq('id', userId)
      .single();

    // Delete user from public.users table
    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      console.error('Error deleting user from public.users:', deleteError);
      return res.status(500).json({ error: 'Failed to delete user from database' });
    }

    console.log('User deleted from public.users:', userId);

    // Try to delete user from Supabase Auth (if exists)
    try {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      console.log('User deleted from Supabase Auth:', userId);
    } catch (authDeleteError) {
      console.log('User not found in Supabase Auth or already deleted:', authDeleteError.message);
      // Continue even if auth deletion fails (user might not exist in auth.users)
    }

    return res.status(200).json({ 
      success: true, 
      message: 'User deleted successfully',
      deletedUser: targetUser
    });
  } catch (error) {
    console.error('Error in delete-user API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};