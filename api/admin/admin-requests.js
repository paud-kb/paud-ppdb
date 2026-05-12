import { createClient } from '@supabase/supabase-js';

// ==========================================
// VALIDATE ENVIRONMENT VARIABLES
// ==========================================

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Log untuk debugging
console.log('[DEBUG] supabaseUrl type:', typeof supabaseUrl);
console.log('[DEBUG] supabaseUrl value:', supabaseUrl ? 'SET' : 'NOT SET');
console.log('[DEBUG] supabaseServiceRoleKey:', supabaseServiceRoleKey ? 'SET' : 'NOT SET');

// Validasi environment variables
if (!supabaseUrl || typeof supabaseUrl !== 'string') {
  return async function handler(req, res) {
    return res.status(500).json({
      success: false,
      error: 'VITE_SUPABASE_URL is not configured or invalid',
      debug: {
        type: typeof supabaseUrl,
        value: supabaseUrl
      }
    });
  };
}

if (!supabaseServiceRoleKey || typeof supabaseServiceRoleKey !== 'string') {
  return async function handler(req, res) {
    return res.status(500).json({
      success: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY is not configured or invalid',
      debug: {
        type: typeof supabaseServiceRoleKey,
        value: supabaseServiceRoleKey ? 'EXISTS' : 'NOT SET'
      }
    });
  };
}

// ==========================================
// CREATE SUPABASE CLIENT
// ==========================================

console.log('[DEBUG] Creating Supabase client...');

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

console.log('[DEBUG] Supabase client created successfully');

// ==========================================
// API HANDLER
// ==========================================

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

    // Fetch all admin_requests
    const { data, error } = await supabaseAdmin
      .from('admin_requests')
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
    console.error('[API] admin-requests error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error'
    });
  }
}