import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient({
  url: supabaseUrl,
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  global: {
    headers: {
      apikey: supabaseServiceRoleKey
    }
  }
});

export default async function handler(req, res) {
    try {
        // Method check
        if (req.method !== 'POST') {
            return res.status(405).json({
                success: false,
                error: 'Method not allowed. Use POST.'
            });
        }

        // Auth check - verify super_admin
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Missing authorization header'
            });
        }

        const token = authHeader.replace('Bearer ', '');

        // Verify token
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired token'
            });
        }

        // Check user role
        const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select('role, is_active')
            .eq('id', user.id)
            .maybeSingle();

        if (userError) {
            return res.status(500).json({
                success: false,
                error: 'Failed to verify user: ' + userError.message
            });
        }

        if (!userData || userData.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Only super_admin can access this endpoint.'
            });
        }

        if (!userData.is_active) {
            return res.status(403).json({
                success: false,
                error: 'Account is inactive.'
            });
        }

        // Get userId from body
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: userId'
            });
        }

        // Prevent deleting self
        if (userId === user.id) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete your own account'
            });
        }

        // Delete user from Supabase Auth
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (error) {
            return res.status(500).json({
                success: false,
                error: 'Failed to delete user: ' + error.message
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                userId: userId,
                message: 'User deleted successfully'
            }
        });

    } catch (err) {
        console.error('[API] delete-user error:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Internal server error'
        });
    }
}
