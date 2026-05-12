import { createClient } from '@supabase/supabase-js';

// Validate environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('[DEBUG] supabaseUrl:', supabaseUrl ? 'SET' : 'NOT SET');
console.log('[DEBUG] supabaseServiceRoleKey:', supabaseServiceRoleKey ? 'SET' : 'NOT SET');

if (!supabaseUrl || typeof supabaseUrl !== 'string') {
  console.error('[DEBUG] VITE_SUPABASE_URL is invalid!');
  // Return handler yang returns error
}

if (!supabaseServiceRoleKey) {
  console.error('[DEBUG] SUPABASE_SERVICE_ROLE_KEY is not set!');
  // Return handler yang returns error
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

export default async function handler(req, res) {
    try {
        // Method check
        if (req.method !== 'GET') {
            return res.status(405).json({
                success: false,
                error: 'Method not allowed. Use GET.'
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

        // Fetch all schools
        const { data, error } = await supabaseAdmin
            .from('schools')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        return res.status(200).json({
            success: true,
            data: data || []
        });

    } catch (err) {
        console.error('[API] schools error:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Internal server error'
        });
    }
}
