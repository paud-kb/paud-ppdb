// ==========================================
// SUPER-ADMIN.JS v6.0 - SECURE WITH API ROUTES
// ==========================================
// PERUBAHAN UTAMA:
// - Service role key TIDAK ADA di frontend
// - Semua operasi admin lewat API routes (server-side)
// - Frontend hanya menggunakan anon key untuk auth session

import { supabase } from '/src/config/supabase.js';

// ==========================================
// GLOBAL STATE
// ==========================================
const SA = {
    requests: [],
    filtered: [],
    currentTarget: null,
    currentUser: null,
    isReady: false,
    authToken: null  // Token untuk API requests
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (!supabase) throw new Error('supabase is NULL');

        const { data: { session }, error: sessErr } = await supabase.auth.getSession();
        if (sessErr || !session) {
            window.location.replace('/admin/login.html');
            return;
        }

        // Simpan auth token untuk API requests
        SA.authToken = session.access_token;

        const { data: me, error: meErr } = await supabase
            .from('users')
            .select('*')
            .eq('email', session.user.email)
            .maybeSingle();

        if (meErr) throw new Error('Query error: ' + meErr.message);
        if (!me) throw new Error(`User not found for email: ${session.user.email}`);
        if (me.role !== 'super_admin') throw new Error(`Access denied. Role: ${me.role}`);

        SA.currentUser = me;
        SA.isReady = true;
        window.__SA_USER = me;

        document.documentElement.classList.remove('dash-auth-pending');
        document.documentElement.classList.add('dash-auth-ready');

        setTimeout(() => {
            if (typeof updateUserInfoDisplay === 'function') updateUserInfoDisplay(me);
        }, 100);

        hideLoader();
        await loadRequests();

    } catch (err) {
        console.error('[SA] FATAL:', err);
        saToast(err.message, 'error');
        hideLoader();
    }
});

// ==========================================
// API REQUEST HELPER
// ==========================================

/**
 * Fetch API dengan authorization header
 * @param {string} url - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} - Response data
 */
async function fetchAPI(url, options = {}) {
    if (!SA.authToken) {
        throw new Error('No authentication token available');
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SA.authToken}`,
        ...options.headers
    };

    const response = await fetch(url, {
        ...options,
        headers
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return data;
}

// ==========================================
// LOADER
// ==========================================
function hideLoader() {
    const loader = document.getElementById('saLoader');
    if (loader) {
        loader.style.transition = 'opacity 0.3s';
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 300);
    }
}

// ==========================================
// LOAD REQUESTS (via API)
// ==========================================
async function loadRequests() {
    try {
        saToast('Memuat data pengajuan...', 'info');

        // Panggil API instead of direct database access
        const result = await fetchAPI('/api/admin/admin-requests');

        SA.requests = result.data || [];
        SA.filtered = [...SA.requests];

        renderTable(SA.filtered);
        updateStats();

    } catch (err) {
        console.error('[SA] loadRequests error:', err);
        saToast('Gagal memuat: ' + err.message, 'error');
    }
}
window.loadRequests = loadRequests;

// ==========================================
// UPDATE STATISTICS
// ==========================================
function updateStats() {
    const total = SA.requests.length;
    const pending = SA.requests.filter(r => r.status === 'pending').length;
    const approved = SA.requests.filter(r => r.status === 'approved').length;
    const rejected = SA.requests.filter(r => r.status === 'rejected').length;

    animateNum('totalRequests', total);
    animateNum('pendingRequests', pending);
    animateNum('approvedRequests', approved);
    animateNum('rejectedRequests', rejected);
}

function animateNum(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const duration = 500;
    const start = performance.now();
    function frame(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased).toLocaleString('id-ID');
        if (progress < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

// ==========================================
// RENDER TABLE
// ==========================================
function renderTable(requests) {
    const tbody = document.getElementById('requestTableBody');
    const empty = document.getElementById('emptyState');
    const table = document.getElementById('requestTable');

    if (!tbody) return;

    if (!requests.length) {
        table.style.display = 'none';
        if (empty) empty.style.display = 'block';
        return;
    }

    if (empty) empty.style.display = 'none';
    table.style.display = 'table';

    tbody.innerHTML = requests.map((r, i) => `
        <tr data-id="${r.id}">
            <td><strong>${i + 1}</strong></td>
            <td style="white-space:nowrap;font-size:13px;color:var(--text-muted);">${formatDate(r.created_at)}</td>
            <td><strong>${esc(r.nama_lengkap)}</strong></td>
            <td style="font-size:13px;">${esc(r.email)}</td>
            <td>
                <div class="school-cell">
                    <span class="school-name">${esc(r.nama_sekolah || '-')}</span>
                    <span class="school-npsn">${esc(r.npsn)}</span>
                </div>
            </td>
            <td><code style="background:#F3E5F5;padding:3px 8px;border-radius:4px;font-size:12px;color:#7B1FA2;">${esc(r.username_desired)}</code></td>
            <td>${renderStatusBadge(r.status)}</td>
            <td>
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                    <button class="action-btn view" onclick="viewDetail('${r.id}')" title="Lihat Detail">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${r.status === 'pending' ? `
                        <button class="action-btn-text approve" onclick="openApproveModal('${r.id}')" title="Setujui">
                            <i class="fas fa-check-circle"></i> Setujui
                        </button>
                        <button class="action-btn-text reject" onclick="openRejectModal('${r.id}', '${esc(r.nama_lengkap).replace(/'/g, "\\'")}', '${esc(r.email)}')" title="Tolak">
                            <i class="fas fa-times-circle"></i> Tolak
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function renderStatusBadge(status) {
    const badges = {
        pending: '<span class="badge badge-pending"><i class="fas fa-clock"></i> Pending</span>',
        approved: '<span class="badge badge-approved"><i class="fas fa-check-circle"></i> Disetujui</span>',
        rejected: '<span class="badge badge-rejected"><i class="fas fa-times-circle"></i> Ditolak</span>'
    };
    return badges[status] || badges.pending;
}

// ==========================================
// FILTER / SEARCH
// ==========================================
function filterRequests() {
    const kw = (document.getElementById('saSearch')?.value || '').toLowerCase().trim();
    if (!kw) {
        SA.filtered = [...SA.requests];
    } else {
        SA.filtered = SA.requests.filter(r =>
            [r.nama_lengkap, r.email, r.username_desired, r.nama_sekolah, String(r.npsn || '')]
                .some(f => String(f || '').toLowerCase().includes(kw))
        );
    }
    renderTable(SA.filtered);
}
window.filterRequests = filterRequests;

// ==========================================
// VIEW DETAIL
// ==========================================
function viewDetail(id) {
    const r = SA.requests.find(x => x.id === id);
    if (!r) return;

    const modalBody = document.getElementById('detailModalBody');
    if (modalBody) {
        modalBody.innerHTML = `
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">ID Request</div>
                    <div class="detail-value" style="font-family:monospace;font-size:12px;">${esc(r.id)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Tanggal Pengajuan</div>
                    <div class="detail-value">${formatDate(r.created_at)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Nama Lengkap</div>
                    <div class="detail-value"><strong>${esc(r.nama_lengkap)}</strong></div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Email</div>
                    <div class="detail-value">${esc(r.email)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">No. HP</div>
                    <div class="detail-value">${esc(r.no_hp)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">NPSN Sekolah</div>
                    <div class="detail-value"><span class="npsn-cell">${esc(r.npsn)}</span></div>
                </div>
                <div class="detail-item" style="grid-column:1/-1;">
                    <div class="detail-label">Nama Sekolah</div>
                    <div class="detail-value"><strong>${esc(r.nama_sekolah || '-')}</strong></div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Username Diminta</div>
                    <div class="detail-value"><code>${esc(r.username_desired)}</code></div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Status</div>
                    <div class="detail-value">${renderStatusBadge(r.status)}</div>
                </div>
            </div>
            ${r.rejection_reason ? `
                <div style="margin-top:16px;padding:14px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:10px;">
                    <div style="font-size:12px;color:var(--danger);font-weight:600;margin-bottom:4px;">
                        <i class="fas fa-ban"></i> Alasan Penolakan:
                    </div>
                    <div style="font-size:14px;color:var(--text-primary);">${esc(r.rejection_reason)}</div>
                </div>
            ` : ''}
            ${r.reviewed_at ? `
                <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border-color);font-size:12px;color:var(--text-muted);text-align:center;">
                    Direview pada: ${formatDateTime(r.reviewed_at)}
                </div>
            ` : ''}
        `;
    }
    showModal('detailModal');
}
window.viewDetail = viewDetail;

// ==========================================
// APPROVE - OPEN MODAL
// ==========================================
function openApproveModal(id) {
    const r = SA.requests.find(x => x.id === id);
    if (!r) return;

    SA.currentTarget = { id, request: r };

    document.getElementById('approveTargetName').textContent = r.nama_lengkap;
    document.getElementById('approveTargetInfo').textContent = `${r.email} • ${esc(r.nama_sekolah || '')} • NPSN: ${r.npsn}`;
    document.getElementById('approvePassword').value = '';
    document.getElementById('approvePassword').type = 'password';
    document.getElementById('approveToggleEye').className = 'fas fa-eye';
    document.getElementById('approvePasswordStrength').innerHTML = '';

    const btn = document.getElementById('confirmApproveBtn');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check-circle"></i> Ya, Setujui!';

    showModal('approveModal');

    setTimeout(() => document.getElementById('approvePassword')?.focus(), 300);
}
window.openApproveModal = openApproveModal;

// ==========================================
// APPROVE - PASSWORD HELPERS
// ==========================================
function toggleApprovePassword() {
    const input = document.getElementById('approvePassword');
    const eye = document.getElementById('approveToggleEye');
    if (input.type === 'password') {
        input.type = 'text';
        eye.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        eye.className = 'fas fa-eye';
    }
}
window.toggleApprovePassword = toggleApprovePassword;

function generatePassword() {
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const nums = '23456789';
    const syms = '!@#$%';
    const all = lower + upper + nums + syms;

    let pass = '';
    pass += lower[Math.floor(Math.random() * lower.length)];
    pass += upper[Math.floor(Math.random() * upper.length)];
    pass += nums[Math.floor(Math.random() * nums.length)];
    pass += syms[Math.floor(Math.random() * syms.length)];
    for (let i = 4; i < 12; i++) {
        pass += all[Math.floor(Math.random() * all.length)];
    }
    pass = pass.split('').sort(() => Math.random() - 0.5).join('');

    const input = document.getElementById('approvePassword');
    input.value = pass;
    input.type = 'text';
    document.getElementById('approveToggleEye').className = 'fas fa-eye-slash';
    checkPasswordStrength(pass);
}
window.generatePassword = generatePassword;

// Realtime password strength check
document.addEventListener('input', (e) => {
    if (e.target.id === 'approvePassword') {
        checkPasswordStrength(e.target.value);
    }
});

function checkPasswordStrength(pw) {
    const el = document.getElementById('approvePasswordStrength');
    if (!el) return;

    if (!pw) { el.innerHTML = ''; return; }

    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;

    if (score <= 2) {
        el.className = 'password-strength strength-weak';
        el.textContent = '⚠️ Lemah — tambahkan huruf besar, angka, dan simbol';
    } else if (score <= 3) {
        el.className = 'password-strength strength-medium';
        el.textContent = '🔸 Cukup — sebaiknya tambahkan simbol';
    } else {
        el.className = 'password-strength strength-strong';
        el.textContent = '✅ Kuat';
    }
}

// ==========================================
// APPROVE - EXECUTE (via API)
// ==========================================
async function executeApprove() {
    if (!SA.currentTarget) {
        saToast('Error: Target tidak valid', 'error');
        return;
    }

    const password = document.getElementById('approvePassword').value.trim();

    if (!password) {
        saToast('Password wajib diisi!', 'warning');
        document.getElementById('approvePassword').focus();
        return;
    }
    if (password.length < 6) {
        saToast('Password minimal 6 karakter!', 'warning');
        document.getElementById('approvePassword').focus();
        return;
    }

    const { id, request } = SA.currentTarget;
    const btn = document.getElementById('confirmApproveBtn');

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';

        // Panggil API approve-request
        const result = await fetchAPI('/api/admin/approve-request', {
            method: 'POST',
            body: JSON.stringify({
                requestId: id,
                plainPassword: password
            })
        });

        if (!result.success) {
            throw new Error(result.error || 'Gagal menyetujui request');
        }

        // Tampilkan password result
        showPasswordResult(request, result.data.plainPassword);

        // Reload data
        await loadRequests();

    } catch (err) {
        console.error('[SA] executeApprove error:', err);
        saToast('Gagal menyetujui: ' + err.message, 'error');

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Ya, Setujui!';
    }
}
window.executeApprove = executeApprove;

// ==========================================
// APPROVE - SHOW PASSWORD RESULT (ONE-TIME)
// ==========================================
function showPasswordResult(request, plainPassword) {
    document.getElementById('resultName').textContent = request.nama_lengkap;
    document.getElementById('resultUsername').textContent = request.username_desired;
    document.getElementById('resultPassword').textContent = plainPassword;

    showModal('resultModal');
}

function copyPassword() {
    const pass = document.getElementById('resultPassword').textContent;
    navigator.clipboard.writeText(pass).then(() => {
        saToast('Password berhasil disalin!', 'success');
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = pass;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        saToast('Password berhasil disalin!', 'success');
    });
}
window.copyPassword = copyPassword;

function closeResultModal() {
    const modal = document.getElementById('resultModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}
window.closeResultModal = closeResultModal;

function closeApproveModal() {
    const modal = document.getElementById('approveModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
    SA.currentTarget = null;
}
window.closeApproveModal = closeApproveModal;

// ==========================================
// REJECT FUNCTIONS (via API)
// ==========================================
function openRejectModal(id, name, email) {
    SA.currentTarget = { id, name, email };
    document.getElementById('rejectTargetName').textContent = name;
    document.getElementById('rejectTargetEmail').textContent = email;
    document.getElementById('rejectReason').value = '';
    showModal('rejectModal');
}
window.openRejectModal = openRejectModal;

async function executeReject() {
    if (!SA.currentTarget) {
        saToast('Error: Target tidak valid', 'error');
        return;
    }

    const reason = document.getElementById('rejectReason').value.trim();
    if (!reason) {
        saToast('Alasan penolakan wajib diisi!', 'warning');
        return;
    }

    const { id, name } = SA.currentTarget;

    try {
        const btn = document.getElementById('confirmRejectBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
        }

        // Panggil API reject-request
        const result = await fetchAPI('/api/admin/reject-request', {
            method: 'POST',
            body: JSON.stringify({
                requestId: id,
                rejectionReason: reason
            })
        });

        if (!result.success) {
            throw new Error(result.error || 'Gagal menolak request');
        }

        saToast(result.data.message || `"${name}" ditolak`, 'warning');
        closeRejectModal();
        await loadRequests();

    } catch (err) {
        console.error('[SA] executeReject error:', err);
        saToast('Gagal menolak: ' + err.message, 'error');

        const btn = document.getElementById('confirmRejectBtn');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-ban"></i> Ya, Tolak!';
        }
    }
}
window.executeReject = executeReject;

// ==========================================
// MODAL HELPERS
// ==========================================
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeDetailModal() {
    const modal = document.getElementById('detailModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}
window.closeDetailModal = closeDetailModal;

function closeRejectModal() {
    const modal = document.getElementById('rejectModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
    SA.currentTarget = null;
}
window.closeRejectModal = closeRejectModal;

// ==========================================
// UTILITY
// ==========================================
function esc(s) {
    if (s === null || s === undefined) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}

function formatDateTime(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

// ==========================================
// TOAST
// ==========================================
function saToast(msg, type = 'info') {
    const box = document.getElementById('toastBox');
    if (!box) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
        <span class="toast-message">${msg}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;

    box.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
window.saToast = saToast;

// ==========================================
// KEYBOARD SHORTCUTS
// ==========================================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeDetailModal();
        closeRejectModal();
        closeApproveModal();
        closeResultModal();
    }
});