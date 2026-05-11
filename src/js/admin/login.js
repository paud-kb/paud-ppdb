// ==========================================
// LOGIN.JS v3.0 - SUPABASE AUTH ONLY
// ==========================================

import { supabase } from '../../config/supabase.js';

window.addEventListener('load', () => {
    const loader = document.getElementById('initLoader');
    if (loader) {
        setTimeout(() => { loader.classList.add('hidden'); setTimeout(() => loader.remove(), 400); }, 300);
    }
});

checkExistingSession();

async function checkExistingSession() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const userData = await getUserData(session.user.id);
            if (userData) redirectToDashboard(userData);
        }
    } catch (err) { /* No session, stay on login page */ }
}

function togglePassword() {
    const passwordInput = document.getElementById('password');
    const toggleEye = document.getElementById('toggleEye');
    if (!passwordInput || !toggleEye) return;
    if (passwordInput.type === 'password') { passwordInput.type = 'text'; toggleEye.classList.remove('fa-eye'); toggleEye.classList.add('fa-eye-slash'); }
    else { passwordInput.type = 'password'; toggleEye.classList.remove('fa-eye-slash'); toggleEye.classList.add('fa-eye'); }
}
window.togglePassword = togglePassword;

function showAlert(message, type = 'error') {
    const alertBox = document.getElementById('alertBox');
    const alertMsg = document.getElementById('alertMsg');
    if (!alertBox || !alertMsg) return;
    alertBox.className = `alert alert-${type} show`;
    alertMsg.textContent = message;
    setTimeout(() => { alertBox.classList.remove('show'); }, 5000);
}

function hideAlert() { const alertBox = document.getElementById('alertBox'); if (alertBox) alertBox.classList.remove('show'); }

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;
    const icons = { success: '<i class="fas fa-check-circle" style="color:var(--accent);"></i>', error: '<i class="fas fa-exclamation-circle" style="color:var(--danger);"></i>', warning: '<i class="fas fa-exclamation-triangle" style="color:var(--warning);"></i>' };
    toast.innerHTML = `${icons[type] || icons.success}<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity='0'; toast.style.transform='translateX(100%)'; toast.style.transition='all 0.3s ease'; setTimeout(()=>toast.remove(),300); }, 4000);
}
window.showToast = showToast;

async function getUserData(userId) {
    try {
        const { data: user, error } = await supabase.from('users').select('*').eq('id', userId).single();
        if (error) throw error;
        return user;
    } catch (err) { return null; }
}
function redirectToDashboard(user) {

    if (!user || !user.role) {
        showAlert('Role user tidak ditemukan', 'error');
        return;
    }

    localStorage.setItem('ppdb_user', JSON.stringify({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        npsn: user.npsn
    }));

    showToast('Login berhasil! Mengalihkan...', 'success');

    setTimeout(() => {

        if (user.role === 'super_admin') {

            window.location.href = '/admin/super-admin.html';

        } else if (
            user.role === 'admin' ||
            user.role === 'operator'
        ) {

            window.location.href = '/admin/dashboard.html';

        } else {

            showAlert('Role tidak valid: ' + user.role, 'error');

        }

    }, 800);
}
window.redirectToDashboard = redirectToDashboard;
async function handleLogin(e) {
    e.preventDefault();
    hideAlert();
    try {

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value.trim();
        if (!email || !password) {
            showAlert('Email dan password wajib diisi', 'error');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showAlert('Format email tidak valid', 'error');
            return;
        }
        const btn = document.getElementById("loginBtn");
        const btnText = document.getElementById("btnText");
        const btnSpinner = document.getElementById("btnSpinner");
        btn.disabled = true;
        btnText.innerText = "Memproses...";
        btnSpinner.style.display = "inline-block";

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) {
            let errorMsg = error.message;
            if (error.message.includes('Invalid login credentials')) {
                errorMsg = 'Email atau password salah!';
            } else if (error.message.includes('Email not confirmed')) {
                errorMsg = 'Email belum diverifikasi.';
            }
            showAlert(errorMsg, 'error');
            resetButton();
            return;
        }
        if (!data.user) {
            showAlert('User tidak ditemukan di sistem', 'error');
            resetButton();
            return;
        }
        const userData = await getUserData(data.user.id);
        if (!userData) {
            showAlert('Data profil user tidak ditemukan. Hubungi Super Admin.', 'error');
            resetButton();
            return;
        }
        redirectToDashboard(userData);
    } catch (err) {
        showAlert('Terjadi kesalahan: ' + err.message, 'error');
        resetButton();
    }
}
window.handleLogin = handleLogin;

function resetButton() {
    const btn = document.getElementById("loginBtn");
    const btnText = document.getElementById("btnText");
    const btnSpinner = document.getElementById("btnSpinner");
    if (btn) btn.disabled = false;
    if (btnText) btnText.innerText = "Masuk ke Dashboard";
    if (btnSpinner) btnSpinner.style.display = "none";
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
        const form = document.getElementById('loginForm');
        if (form) form.dispatchEvent(new Event('submit'));
    }
});