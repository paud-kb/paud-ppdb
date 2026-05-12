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

        // Get request data from body
        const { requestId, rejectionReason } = req.body;

        if (!requestId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: requestId'
            });
        }

        if (!rejectionReason || rejectionReason.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Rejection reason is required'
            });
        }

        // Check if request exists and is pending
        const { data: request, error: reqError } = await supabaseAdmin
            .from('admin_requests')
            .select('nama_lengkap, status')
            .eq('id', requestId)
            .maybeSingle();

        if (reqError) {
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch request: ' + reqError.message
            });
        }

        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Request not found'
            });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({
                success: false,
                error: 'Request is not in pending status'
            });
        }

        // Update admin_requests
        const { data: updateData, error: updateErr } = await supabaseAdmin
            .from('admin_requests')
            .update({
                status: 'rejected',
                rejection_reason: rejectionReason.trim(),
                reviewed_by: user.id,
                reviewed_at: new Date().toISOString()
            })
            .eq('id', requestId)
            .select('id, status, nama_lengkap');

        if (updateErr) {
            return res.status(500).json({
                success: false,
                error: 'Failed to reject request: ' + updateErr.message
            });
        }

        if (!updateData || updateData.length === 0) {
            return res.status(500).json({
                success: false,
                error: 'Update failed: No rows updated. ID: ' + requestId
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                request: updateData[0],
                message: `Request from "${updateData[0].nama_lengkap}" has been rejected`
            }
        });

    } catch (err) {
        console.error('[API] reject-request error:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Internal server error'
        });
    }
}
