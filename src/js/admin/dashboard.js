// ==========================================
// DASHBOARD.JS v10.0 - DARK THEME + CLEAN
// ==========================================

import { supabase } from '../../config/supabase.js';

const Dash = {
  user: null,
  npsn: null,
  schoolName: null,
  registrations: [],
  filtered: [],
  page: 1,
  perPage: 10,
  isInitialized: false
};

document.addEventListener('DOMContentLoaded', async function() {
  try {
    const { data: { session }, error: sessErr } = await supabase.auth.getSession();
    if (sessErr) throw new Error('Session error');
    if (!session) throw new Error('No active session');

    const { data: userData, error: userErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    if (userErr) throw new Error('Query error');
    if (!userData) throw new Error('Data user tidak ditemukan');

    Dash.user = userData;
    Dash.npsn = userData.npsn || null;
    window.__USER_DATA = userData;

    document.documentElement.classList.remove('dash-auth-pending');
    document.documentElement.classList.add('dash-auth-ready');

    updateHeaderUI();
    showNpsnBadges();

    if (userData.role === 'super_admin') {
      const saLink = document.getElementById('saMenuLink');
      if (saLink) saLink.style.display = 'flex';
    }

    await Promise.all([loadSchoolInfo(), loadRegistrations()]);

    hideLoader();
    Dash.isInitialized = true;

  } catch (err) {
    handleFatalError(err.message);
  }
});

function handleFatalError(message) {
  hideLoader();
  const errDiv = document.createElement('div');
  errDiv.style.cssText = 'position:fixed;inset:0;background:var(--bg-primary);display:flex;align-items:center;justify-content:center;z-index:99999;flex-direction:column;gap:16px;padding:40px;text-align:center;font-family:Inter,sans-serif;';
  errDiv.innerHTML = `
    <div style="font-size:4rem;">⚠️</div>
    <h2 style="color:var(--danger);margin:0;font-size:1.4rem;">Terjadi Kesalahan</h2>
    <p style="color:var(--text-secondary);margin:0;font-size:0.95rem;max-width:420px;line-height:1.6;">${message}</p>
    <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
      <button onclick="location.reload()" style="padding:12px 28px;background:var(--accent);color:white;border:none;border-radius:10px;font-weight:600;cursor:pointer;font-size:0.95rem;">🔄 Refresh Halaman</button>
      <button onclick="localStorage.clear();location.href='/admin/login.html'" style="padding:12px 28px;background:var(--bg-card);color:var(--text-secondary);border:1px solid var(--border-color);border-radius:10px;font-weight:600;cursor:pointer;font-size:0.95rem;">🔑 Login Ulang</button>
    </div>
  `;
  document.body.appendChild(errDiv);
}

function updateHeaderUI() {
  if (!Dash.user) return;
  const name = Dash.user.full_name || 'Admin';
  safeText('headerUserName', name);
  safeText('welcomeName', name.split(' ')[0]);
  safeText('headerUserRole', Dash.user.role === 'super_admin' ? 'Super Admin' : 'Administrator');
}

function showNpsnBadges() {
  if (!Dash.npsn) return;
  safeText('npsnValue', Dash.npsn);
  showEl('npsnBadge');
  safeText('tableNpsnValue', Dash.npsn);
  showEl('tableNpsnBadge');
  safeText('emptyNpsn', Dash.npsn);
}

function hideLoader() {
  const loader = document.getElementById('dashLoader');
  if (loader) { loader.style.transition = 'opacity 0.3s'; loader.style.opacity = '0'; setTimeout(() => loader.remove(), 300); }
}

async function loadRegistrations() {
  toggleLoading(true);
  try {
    let query = supabase.from('registrations').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (Dash.user.role !== 'super_admin' && Dash.npsn) query = query.eq('npsn', Dash.npsn);
    const { data, error } = await query;
    if (error) throw error;
    Dash.registrations = data || [];
    Dash.filtered = [...Dash.registrations];
    Dash.page = 1;
    updateStats(Dash.registrations);
    renderTable(Dash.filtered);
  } catch (err) {
    showToast('Gagal memuat data: ' + err.message, 'error');
    showEl('emptyState');
  } finally {
    toggleLoading(false);
  }
}
window.loadRegistrations = loadRegistrations;

async function loadSchoolInfo() {
  try {
    if (Dash.user.role === 'super_admin') { Dash.schoolName = 'Semua Sekolah'; }
    else if (Dash.npsn) {
      const { data } = await supabase.from('schools').select('nama_sekolah').eq('npsn', Dash.npsn).maybeSingle();
      Dash.schoolName = data?.nama_sekolah || `NPSN ${Dash.npsn}`;
    } else { Dash.schoolName = 'Sekolah'; }
    safeText('schoolBadgeName', Dash.schoolName);
  } catch (e) { safeText('schoolBadgeName', 'Sekolah'); }
}

function updateStats(data) {
  const today = new Date().toISOString().split('T')[0];
  animateNum('statTotal', data.length);
  animateNum('statToday', data.filter(r => r.created_at?.startsWith(today)).length);
  animateNum('statDocs', data.filter(r => r.url_kk && r.url_akta).length);
  animateNum('statComplete', data.filter(r => r.nama_lengkap && r.no_hp_ibu).length);
}

function animateNum(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const duration = 700, start = performance.now();
  function frame(now) {
    const p = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString('id-ID');
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function renderTable(data) {
  const tbody = document.getElementById('tableBody');
  const table = document.getElementById('dataTable');
  const empty = document.getElementById('emptyState');
  const pagination = document.getElementById('pagination');
  if (!tbody || !table || !empty) return;

  if (!data.length) { table.style.display = 'none'; empty.style.display = 'block'; if (pagination) pagination.style.display = 'none'; return; }
  empty.style.display = 'none'; table.style.display = 'table';

  const startIdx = (Dash.page - 1) * Dash.perPage;
  const pageData = data.slice(startIdx, startIdx + Dash.perPage);

  tbody.innerHTML = pageData.map((r, i) => `
    <tr>
      <td><strong>${startIdx + i + 1}</strong></td>
      <td><span class="reg-number">${esc(r.nomor_pendaftaran)}</span></td>
      <td class="student-name">${esc(r.nama_lengkap)}</td>
      <td><span class="gender-badge ${r.jenis_kelamin === 'P' ? 'badge-perempuan' : 'badge-laki'}">${r.jenis_kelamin === 'P' ? '👧 P' : '👦 L'}</span></td>
      <td class="parent-info">${esc(r.nama_ibu_kandung)}</td>
      <td class="parent-info">${fmtPhone(r.no_hp_ibu)}</td>
      <td>
        <div class="doc-icons">
          ${r.url_kk ? `<button class="doc-btn doc-kk" onclick="viewDoc('${r.url_kk}','KK')" title="Lihat KK">📄</button>` : `<button class="doc-btn disabled" disabled title="KK belum upload">📄</button>`}
          ${r.url_akta ? `<button class="doc-btn doc-akta" onclick="viewDoc('${r.url_akta}','Akta')" title="Lihat Akta">👶</button>` : `<button class="doc-btn disabled" disabled title="Akta belum upload">👶</button>`}
        </div>
      </td>
      <td class="date-cell">${fmtDate(r.created_at)}</td>
      <td><button class="action-btn" onclick="showDetail('${r.id}')"><i class="fas fa-eye"></i> Detail</button></td>
    </tr>
  `).join('');

  const totalPages = Math.ceil(data.length / Dash.perPage);
  if (pagination) {
    if (data.length > Dash.perPage) {
      pagination.style.display = 'flex';
      safeText('pageInfo', `Hal ${Dash.page}/${totalPages} (${data.length} data)`);
      const prevBtn = document.getElementById('prevBtn');
      const nextBtn = document.getElementById('nextBtn');
      if (prevBtn) prevBtn.disabled = Dash.page <= 1;
      if (nextBtn) nextBtn.disabled = Dash.page >= totalPages;
    } else { pagination.style.display = 'none'; }
  }
}

function filterTable() {
  const kw = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  Dash.filtered = !kw ? [...Dash.registrations] : Dash.registrations.filter(r =>
    [r.nomor_pendaftaran, r.nama_lengkap, r.nama_ibu_kandung].some(f => String(f || '').toLowerCase().includes(kw))
  );
  Dash.page = 1;
  renderTable(Dash.filtered);
}
window.filterTable = filterTable;

function changePage(delta) {
  const totalPages = Math.ceil(Dash.filtered.length / Dash.perPage);
  const newPage = Dash.page + delta;
  if (newPage >= 1 && newPage <= totalPages) { Dash.page = newPage; renderTable(Dash.filtered); }
}
window.changePage = changePage;

function viewDoc(path, label) {
  if (!path) { showToast(`${label} tidak tersedia`, 'warning'); return; }
  try {
    const { data } = supabase.storage.from('npsn-banjar').getPublicUrl(path);
    if (!data?.publicUrl) { showToast('Dokumen gagal dibuka', 'error'); return; }
    window.open(data.publicUrl, '_blank');
  } catch (e) { showToast('Gagal membuka dokumen', 'error'); }
}
window.viewDoc = viewDoc;

function showDetail(id) {
  const r = Dash.registrations.find(x => x.id === id);
  if (!r) { showToast('Data tidak ditemukan', 'warning'); return; }

  let kkUrl = null, aktaUrl = null;
  try {
    if (r.url_kk) kkUrl = supabase.storage.from('npsn-banjar').getPublicUrl(r.url_kk).data.publicUrl;
    if (r.url_akta) aktaUrl = supabase.storage.from('npsn-banjar').getPublicUrl(r.url_akta).data.publicUrl;
  } catch (e) {}

  const mc = document.getElementById('modalBodyContent');
  if (mc) {
    mc.innerHTML = `
      <div class="detail-section-title">👶 Calon Siswa</div>
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-label">No. Pendaftaran</div><div class="detail-value" style="color:var(--accent);font-weight:700">${esc(r.nomor_pendaftaran)}</div></div>
        <div class="detail-item"><div class="detail-label">NPSN</div><div class="detail-value">${esc(r.npsn)}</div></div>
        <div class="detail-item"><div class="detail-label">Nama Lengkap</div><div class="detail-value">${esc(r.nama_lengkap)}</div></div>
        <div class="detail-item"><div class="detail-label">Jenis Kelamin</div><div class="detail-value">${r.jenis_kelamin === 'P' ? 'Perempuan' : 'Laki-laki'}</div></div>
        <div class="detail-item"><div class="detail-label">NIK</div><div class="detail-value">${r.npk || r.nik || '-'}</div></div>
        <div class="detail-item"><div class="detail-label">Tempat, Tanggal Lahir</div><div class="detail-value">${esc(r.tempat_lahir || '-')}, ${r.tanggal_lahir || '-'}</div></div>
      </div>
      <div class="detail-section-title">👩 Ibu/Wali</div>
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-label">Nama Ibu Kandung</div><div class="detail-value">${esc(r.nama_ibu_kandung)}</div></div>
        <div class="detail-item"><div class="detail-label">No. HP Ibu</div><div class="detail-value">${fmtPhone(r.no_hp_ibu)}</div></div>
      </div>
      <div class="detail-section-title">📎 Dokumen</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div><div class="detail-label">Kartu Keluarga</div>${kkUrl ? `<img src="${kkUrl}" class="doc-preview-img" onclick="window.open(this.src)" alt="KK">` : '<p style="color:var(--text-muted);padding:16px;background:var(--bg-secondary);border-radius:10px;text-align:center;font-size:.88rem;border:2px dashed var(--border-color);">Belum upload</p>'}</div>
        <div><div class="detail-label">Akta Kelahiran</div>${aktaUrl ? `<img src="${aktaUrl}" class="doc-preview-img" onclick="window.open(this.src)" alt="Akta">` : '<p style="color:var(--text-muted);padding:16px;background:var(--bg-secondary);border-radius:10px;text-align:center;font-size:.88rem;border:2px dashed var(--border-color);">Belum upload</p>'}</div>
      </div>
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border-color);font-size:.82rem;color:var(--text-muted);text-align:center">Terdaftar pada: ${fmtDate(r.created_at)}</div>
    `;
  }
  const modal = document.getElementById('detailModal');
  if (modal) { modal.classList.add('show'); document.body.style.overflow = 'hidden'; }
}
window.showDetail = showDetail;

function closeDetailModal() {
  const modal = document.getElementById('detailModal');
  if (modal) modal.classList.remove('show');
  document.body.style.overflow = '';
}
window.closeDetailModal = closeDetailModal;

function downloadCSV() {
  if (!Dash.filtered.length) { showToast('Tidak ada data untuk didownload', 'warning'); return; }
  try {
    const headers = ['No_Pendaftaran','NPSN','Nama','JK','Nama_Ibu','HP_Ibu','Tanggal_Daftar'];
    const rows = Dash.filtered.map(r => [r.nomor_pendaftaran, r.npsn, `"${(r.nama_lengkap||'').replace(/"/g,'""')}"`, r.jenis_kelamin||'', `"${(r.nama_ibu_kandung||'').replace(/"/g,'""')}"`, r.no_hp_ibu||'', r.created_at||'']);
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `PPDB_${Dash.npsn || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast(`Berhasil download ${Dash.filtered.length} data!`, 'success');
  } catch (e) { showToast('Gagal download CSV', 'error'); }
}
window.downloadCSV = downloadCSV;

function esc(str) { if (str === null || str === undefined) return ''; const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
function fmtPhone(p) { if (!p) return '-'; const c = p.replace(/\D/g,''); if (c.startsWith('62')) return '+' + c.replace(/(\d{2})(\d{3})(\d{4})(\d+)/, '+$1 $2-$3-$4'); if (c.startsWith('0')) return c.replace(/(\d{3})(\d{4})(\d+)/, '$1-$2-$3'); return p; }
function fmtDate(d) { if (!d) return '-'; try { return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); } catch(e) { return d; } }
function safeText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function showEl(id) { const el = document.getElementById(id); if (el) el.style.display = ''; }
function toggleLoading(show) { const l = document.getElementById('tableLoading'); const t = document.getElementById('dataTable'); if (l) l.style.display = show ? 'block' : 'none'; if (t) t.style.display = show ? 'none' : (Dash.filtered.length ? 'table' : 'none'); }

function showToast(msg, type = 'info') {
  if (typeof window.showToast === 'function' && window.showToast !== showToast) { window.showToast(msg, type); return; }
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast-item ${type}`;
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  toast.innerHTML = `<span style="font-size:1.1rem">${icons[type]||'ℹ️'}</span><span style="flex:1;font-size:.9rem">${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity='0'; toast.style.transform='translateX(100%)'; toast.style.transition='all 0.3s ease'; setTimeout(()=>toast.remove(),300); }, 3500);
}