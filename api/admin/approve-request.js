// ==========================================
// REQUEST BODY
// ==========================================
const { requestId, password, passwordHash } = req.body;

if (!requestId || !password || !passwordHash) {
  return res.status(400).json({
    error: 'Missing requestId, password, or passwordHash'
  });
}

if (password.length < 6) {
  return res.status(400).json({
    error: 'Password minimal 6 karakter'
  });
}

console.log('Processing approval for request:', requestId);

// ==========================================
// FETCH REQUEST DATA
// ==========================================
const { data: requestData, error: requestError } =
  await supabaseAdmin
    .from('admin_requests')
    .select('*')
    .eq('id', requestId)
    .single();

if (requestError || !requestData) {
  console.error('Request not found:', requestError);

  return res.status(404).json({
    error: 'Request not found'
  });
}

if (requestData.status !== 'pending') {
  return res.status(400).json({
    error: 'Request has already been processed'
  });
}

// ==========================================
// PRE-CHECK USERNAME
// ==========================================
const { data: existingUser } =
  await supabaseAdmin
    .from('users')
    .select('id')
    .eq('username', requestData.username_desired)
    .single();

if (existingUser) {
  return res.status(400).json({
    error: 'Username already exists',
    username: requestData.username_desired
  });
}

// ==========================================
// PRE-CHECK EMAIL USERS TABLE
// ==========================================
const { data: existingEmailUser } =
  await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', requestData.email)
    .single();

if (existingEmailUser) {
  return res.status(400).json({
    error: 'Email already exists in users table',
    email: requestData.email
  });
}

// ==========================================
// PRE-CHECK AUTH USER
// ==========================================
const { data: authList } =
  await supabaseAdmin.auth.admin.listUsers();

const authExists =
  authList?.users?.find(
    u => u.email?.toLowerCase() === requestData.email.toLowerCase()
  );

if (authExists) {
  return res.status(400).json({
    error: 'Email already registered in authentication',
    email: requestData.email
  });
}

// ==========================================
// PRE-CHECK NPSN
// ==========================================
const { data: existingSchoolUser } =
  await supabaseAdmin
    .from('users')
    .select('id, npsn')
    .eq('npsn', requestData.npsn)
    .single();

if (existingSchoolUser) {
  return res.status(400).json({
    error: 'School already has admin account',
    npsn: requestData.npsn
  });
}

// ==========================================
// CREATE SCHOOL
// ==========================================
const { data: schoolData, error: schoolCheckError } =
  await supabaseAdmin
    .from('schools')
    .select('*')
    .eq('npsn', requestData.npsn)
    .single();

let isSchoolNew = false;

if (!schoolData && schoolCheckError?.code === 'PGRST116') {

  console.log('Creating school:', requestData.npsn);

  const { error: schoolInsertError } =
    await supabaseAdmin
      .from('schools')
      .insert([{
        npsn: requestData.npsn,
        nama_sekolah: requestData.nama_sekolah,
        password_hash: passwordHash,
        is_active: true
      }]);

  if (schoolInsertError) {
    console.error('School create error:', schoolInsertError);

    return res.status(500).json({
      error: 'Failed to create school',
      details: schoolInsertError.message
    });
  }

  isSchoolNew = true;
}

// ==========================================
// CREATE AUTH USER
// ==========================================
console.log('Creating auth user...');

const {
  data: authData,
  error: authCreateError
} = await supabaseAdmin.auth.admin.createUser({
  email: requestData.email,
  password: password,
  email_confirm: true
});

if (authCreateError) {

  console.error('Auth create error:', authCreateError);

  // rollback school jika baru dibuat
  if (isSchoolNew) {
    await supabaseAdmin
      .from('schools')
      .delete()
      .eq('npsn', requestData.npsn);
  }

  return res.status(500).json({
    error: 'Failed to create auth user',
    details: authCreateError.message
  });
}

const authUserId = authData.user.id;

console.log('Auth user created:', authUserId);

// ==========================================
// CREATE USERS TABLE
// ==========================================
console.log('Creating users table record...');

const { error: userInsertError } =
  await supabaseAdmin
    .from('users')
    .insert([{
      id: authUserId,
      username: requestData.username_desired,
      password_hash: passwordHash,
      full_name: requestData.nama_lengkap,
      email: requestData.email,
      no_hp: requestData.no_hp,
      role: 'admin',
      npsn: requestData.npsn,
      is_active: true,
      is_verified: false,
      created_by: user.id
    }]);

if (userInsertError) {

  console.error('Users insert error:', userInsertError);

  // rollback auth user
  await supabaseAdmin.auth.admin.deleteUser(authUserId);

  // rollback school
  if (isSchoolNew) {
    await supabaseAdmin
      .from('schools')
      .delete()
      .eq('npsn', requestData.npsn);
  }

  return res.status(500).json({
    error: 'Failed to create user table record',
    details: userInsertError.message
  });
}

console.log('Users table success');

// ==========================================
// UPDATE REQUEST STATUS
// ==========================================
const { error: updateError } =
  await supabaseAdmin
    .from('admin_requests')
    .update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', requestId);

if (updateError) {
  console.error('Update request status error:', updateError);
}

// ==========================================
// SUCCESS
// ==========================================
return res.status(200).json({
  success: true,
  message: 'Admin approved successfully',
  school_created: isSchoolNew,
  auth_user_created: true,
  auth_user_id: authUserId,
  npsn: requestData.npsn
});