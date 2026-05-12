// ==========================================
// API: POST /api/admin/approve-request
// Fungsi: Menyetujui admin request
// Operasi:
//   1. Hash password via RPC
//   2. Create Supabase Auth user
//   3. Insert ke tabel schools
//   4. Insert ke tabel users
//   5. Update admin_requests status = approved
// Auth: Hanya super_admin
// ==========================================

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
        const { requestId, plainPassword } = req.body;

        if (!requestId || !plainPassword) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: requestId and plainPassword'
            });
        }

        if (plainPassword.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 6 characters'
            });
        }

        // Get admin_request data
        const { data: request, error: reqError } = await supabaseAdmin
            .from('admin_requests')
            .select('*')
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

        // STEP 1: Hash password via RPC
        const { data: hashResult, error: hashError } = await supabaseAdmin.rpc('hash_password', {
            plain_text: plainPassword
        });

        if (hashError) {
            return res.status(500).json({
                success: false,
                error: 'Failed to hash password: ' + hashError.message
            });
        }

        const passwordHash = hashResult;

        // STEP 2: Create Supabase Auth user
        let authUserId;
        const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
            email: request.email,
            password: plainPassword,
            email_confirm: true,
            user_metadata: {
                full_name: request.nama_lengkap,
                role: 'admin',
                npsn: request.npsn
            }
        });

        if (authCreateError) {
            const msg = (authCreateError.message || '').toLowerCase();
            if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('user already exists')) {
                return res.status(400).json({
                    success: false,
                    error: 'Email "' + request.email + '" is already registered. Use a different email.'
                });
            }
            return res.status(500).json({
                success: false,
                error: 'Failed to create auth user: ' + authCreateError.message
            });
        }

        authUserId = authData.user.id;

        try {
            // STEP 3: Insert school (harus duluan karena FK users.npsn → schools.npsn)
            const { error: schoolErr } = await supabaseAdmin
                .from('schools')
                .insert({
                    npsn: request.npsn,
                    nama_sekolah: request.nama_sekolah,
                    password_hash: passwordHash,
                    is_active: true
                });

            if (schoolErr) {
                const msg = (schoolErr.message || '').toLowerCase();
                if (!msg.includes('duplicate') && !msg.includes('unique')) {
                    throw new Error('Failed to create school: ' + schoolErr.message);
                }
                // Duplicate school is OK (NPSN sudah ada)
            }

            // STEP 4: Insert user
            const { error: userErr } = await supabaseAdmin
                .from('users')
                .insert({
                    id: authUserId,
                    username: request.username_desired,
                    password_hash: passwordHash,
                    full_name: request.nama_lengkap,
                    email: request.email,
                    no_hp: request.no_hp,
                    role: 'admin',
                    npsn: request.npsn,
                    is_active: true,
                    is_verified: false,
                    created_by: user.id
                });

            if (userErr) {
                const msg = (userErr.message || '').toLowerCase();
                if (msg.includes('duplicate') || msg.includes('unique')) {
                    throw new Error('Username "' + request.username_desired + '" is already taken.');
                }
                throw new Error('Failed to create user: ' + userErr.message);
            }

            // STEP 5: Update admin_requests
            const { data: updateData, error: updateErr } = await supabaseAdmin
                .from('admin_requests')
                .update({
                    status: 'approved',
                    reviewed_by: user.id,
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', requestId)
                .select('id, status');

            if (updateErr) {
                throw new Error('Failed to update request: ' + updateErr.message);
            }

            if (!updateData || updateData.length === 0) {
                throw new Error('Update failed: No rows updated. ID: ' + requestId);
            }

            // Success response - include plain password for one-time display
            return res.status(200).json({
                success: true,
                data: {
                    authUserId: authUserId,
                    plainPassword: plainPassword,
                    username: request.username_desired,
                    email: request.email,
                    fullName: request.nama_lengkap,
                    npsn: request.npsn,
                    schoolName: request.nama_sekolah,
                    request: updateData[0]
                }
            });

        } catch (err) {
            // Rollback: delete auth user if any step fails
            try {
                await supabaseAdmin.auth.admin.deleteUser(authUserId);
            } catch (e) {
                console.error('[API] Failed to rollback auth user:', e);
            }

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }

    } catch (err) {
        console.error('[API] approve-request error:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Internal server error'
        });
    }
}
