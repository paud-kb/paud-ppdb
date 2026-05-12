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

    const { requestId, reason } = req.body;

    if (!requestId) {
      return res.status(400).json({ error: 'requestId is required' });
    }

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    // Check if request exists and is pending
    const { data: requestData, error: requestError } = await supabaseAdmin
      .from('admin_requests')
      .select('status')
      .eq('id', requestId)
      .single();

    if (requestError || !requestData) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (requestData.status !== 'pending') {
      return res.status(400).json({ error: 'Request has already been processed' });
    }

    // Update the admin_requests status to rejected
    const { error: updateError } = await supabaseAdmin
      .from('admin_requests')
      .update({
        status: 'rejected',
        rejection_reason: reason,
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
      message: 'Admin request rejected successfully' 
    });
  } catch (error) {
    console.error('Error in reject-request API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};