// ==========================================
// GLOBAL VARIABLES
// ==========================================
import '../css/style.css';
import { supabase } from '../config/supabase.js';

let selectedSchool = null;
let schoolsData = [];
let inactivityTimer = null; // Timer global untuk reset 10 detik

// ==========================================
// DOM ELEMENTS
// ==========================================
const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileMenu = document.getElementById('mobileMenu');
const menuOverlay = document.getElementById('menuOverlay');

const schoolGrid = document.getElementById('schoolGrid');
const schoolGridLoading = document.getElementById('schoolGridLoading');

// Elemen untuk Custom Search (Baru)
const schoolSearchInput = document.getElementById('schoolSearchInput');
const schoolDropdownList = document.getElementById('schoolDropdownList');
const btnCariSekolah = document.getElementById('btnCariSekolah');
const btnLihatSemua = document.getElementById('btnLihatSemua');

// Elemen lama (dianggap sudah dihapus/replaced di HTML, tapi dijaga referensinya agar tidak error)
const schoolSelect = document.getElementById('schoolSelect'); 
const emptyState = document.getElementById('emptyState');
const errorState = document.getElementById('errorState');

const nextBtn = document.getElementById('nextBtn');
const nextButtonContainer = document.getElementById('nextButtonContainer');
const mainHeader = document.getElementById('mainHeader');

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', function () {
  console.log('[App] Initializing...');

  initHamburgerMenu();
  initHeaderScroll();
  // initSchoolSearch dipanggil di dalam loadSchools setelah data siap
  loadSchools(); 
});

// ==========================================
// HAMBURGER MENU
// ==========================================
function initHamburgerMenu() {

  if (!hamburgerBtn || !mobileMenu || !menuOverlay) return;

  window.toggleMenu = function () {

    const isActive = mobileMenu.classList.contains('active');

    mobileMenu.classList.toggle('active');
    menuOverlay.classList.toggle('active');
    hamburgerBtn.classList.toggle('active');

    document.body.style.overflow = isActive ? '' : 'hidden';
  };

  window.closeMenu = function () {

    mobileMenu.classList.remove('active');
    menuOverlay.classList.remove('active');
    hamburgerBtn.classList.remove('active');

    document.body.style.overflow = '';
  };

  hamburgerBtn.addEventListener('click', window.toggleMenu);

  menuOverlay.addEventListener('click', window.closeMenu);

  // ESC CLOSE
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.closeMenu();
    }
  });
}

// ==========================================
// HEADER SCROLL EFFECT
// ==========================================
function initHeaderScroll() {

  window.addEventListener('scroll', () => {

    const currentScroll = window.pageYOffset;

    if (currentScroll > 50) {
      mainHeader.classList.add('scrolled');
    } else {
      mainHeader.classList.remove('scrolled');
    }
  });
}

// ==========================================
// LOAD SCHOOLS FROM SUPABASE
// ==========================================
async function loadSchools() {

  console.log('[App] Loading schools...');

  // SHOW LOADING
  schoolGridLoading.style.display = 'grid';
  schoolGrid.style.display = 'none';

  emptyState.style.display = 'none';
  errorState.style.display = 'none';

  try {

    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .eq('is_active', true)
      .order('nama_sekolah', { ascending: true });

    if (error) {
      throw error;
    }

    console.log('[App] Schools loaded:', data);

    // HIDE LOADING
    schoolGridLoading.style.display = 'none';

    // EMPTY
    if (!data || data.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    schoolsData = data;

    // TAMPILKAN GRID KOTAK PENCARIAN
    if (schoolGrid) {
      schoolGrid.style.display = 'block';
    }

    // INISIALISASI PENCARIAN CUSTOM
    initSchoolSearch();

  } catch (error) {

    console.error('[App] Error loading schools:', error);

    schoolGridLoading.style.display = 'none';

    errorState.style.display = 'block';

    document.getElementById('errorMessage').textContent =
      error.message || 'Gagal mengambil data sekolah.';
  }
}

// ==========================================
// INIT CUSTOM SEARCH SCHOOL (LOGIKA BARU)
// ==========================================
function initSchoolSearch() {
  // Pastikan elemen ada di HTML
  if (!schoolSearchInput || !schoolDropdownList || !btnCariSekolah || !btnLihatSemua) return;

  // Fungsi Reset Timer 10 Detik
  const resetTimer = () => {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      console.log('[Timer] Reset input (30 detik)');
      schoolSearchInput.value = '';
      schoolDropdownList.style.display = 'none';
      schoolDropdownList.innerHTML = '';
      if (selectedSchool) showToast('Waktu pencarian habis', 'info');
    }, 30000);
  };

  // Fungsi Filter & Render List
  const filterSchools = (keyword) => {
    schoolDropdownList.innerHTML = ''; 

    // Jika kosong, tampilkan SEMUA data (bukan sembunyikan)
    const keywordLower = keyword.toLowerCase();
    
    const filtered = schoolsData.filter(school => {
      return (school.nama_sekolah || '').toLowerCase().includes(keywordLower) ||
             (school.npsn || '').includes(keywordLower);
    });

    if (filtered.length === 0) {
      const li = document.createElement('li');
      li.innerHTML = `<span>Tidak ditemukan sekolah dengan kata "${keyword}"</span>`;
      li.style.cursor = 'default';
      schoolDropdownList.appendChild(li);
    } else {
      filtered.forEach(school => {
        const li = document.createElement('li');
        li.innerHTML = `
          <strong>${school.nama_sekolah}</strong>
          <span>NPSN: ${school.npsn}</span>
        `;
        
        li.addEventListener('click', () => {
          schoolSearchInput.value = school.nama_sekolah;
          schoolDropdownList.style.display = 'none';
          selectSchool(school);
          clearTimeout(inactivityTimer); // Stop timer jika user memilih
        });

        schoolDropdownList.appendChild(li);
      });
    }

    schoolDropdownList.style.display = 'block';
  };

  // EVENT 1: Mengetik di Input
  schoolSearchInput.addEventListener('input', (e) => {
    resetTimer();
    filterSchools(e.target.value);
  });

  // EVENT 2: Tombol Lihat Daftar
  btnLihatSemua.addEventListener('click', () => {
    schoolSearchInput.value = '';
    schoolSearchInput.focus();
    filterSchools(''); // Tampilkan semua
    resetTimer();
  });

  // EVENT 3: Tombol Cari
  btnCariSekolah.addEventListener('click', () => {
    resetTimer();
    filterSchools(schoolSearchInput.value.trim());
    schoolSearchInput.focus();
  });

  // EVENT 4: Klik di luar area dropdown
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-search-container')) {
      schoolDropdownList.style.display = 'none';
    }
  });
  
  // EVENT 5: Focus pada input (Munculkan list jika ada isi)
  schoolSearchInput.addEventListener('focus', () => {
    if (schoolSearchInput.value.trim()) {
      schoolDropdownList.style.display = 'block';
    }
  });
}

// ==========================================
// SELECT SCHOOL
// ==========================================
function selectSchool(school) {

  selectedSchool = school;

  nextBtn.disabled = false;

  nextBtn.innerHTML = `
    <span>Daftar di ${escapeHtml(school.nama_sekolah)}</span>
    <i class="fas fa-arrow-right"></i>
  `;

  nextButtonContainer.style.display = 'block';

  console.log(
    '[App] Selected school:',
    school.nama_sekolah
  );

  showToast(
    `Sekolah dipilih: ${school.nama_sekolah}`,
    'success'
  );

  // SCROLL BUTTON
  setTimeout(() => {

    nextButtonContainer.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

  }, 300);
}

// ==========================================
// GO TO REGISTRATION PAGE (PERBAIKAN BUG NAVIGASI)
// ==========================================
window.goToRegistration = function () {

  if (!selectedSchool) {

    showToast(
      'Silakan pilih sekolah terlebih dahulu',
      'warning'
    );

    return;
  }

  // 1. HENTIKAN TIMER 10 DETIK (Mencegah Bentrok)
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    console.log('[Nav] Timer dihentikan sebelum pindah halaman');
  }

  // 2. SIMPAN DATA KE SESSION STORAGE
  sessionStorage.setItem(
    'selectedNPSN',
    selectedSchool.npsn
  );

  sessionStorage.setItem(
    'selectedSchoolName',
    selectedSchool.nama_sekolah
  );
  
  // Simpan objek lengkap agar halaman ppdb.html bisa pakai
  sessionStorage.setItem('selectedSchoolFull', JSON.stringify(selectedSchool));

  // 3. REDIRECT
  console.log('[Nav] Mengarahkan ke ppdb.html...');
  
  window.location.href =
    `/ppdb.html?npsn=${selectedSchool.npsn}`;
};

// ==========================================
// TOAST NOTIFICATION SYSTEM
// ==========================================
function showToast(message, type = 'info') {

  const container =
    document.getElementById('toastContainer');

  if (!container) return;

  const toast = document.createElement('div');

  toast.className = `toast ${type}`;

  let icon = 'fa-info-circle';

  if (type === 'success') {
    icon = 'fa-check-circle';
  }

  if (type === 'error') {
    icon = 'fa-exclamation-circle';
  }

  if (type === 'warning') {
    icon = 'fa-exclamation-triangle';
  }

  toast.innerHTML = `
    <i class="fas ${icon} toast-icon"></i>

    <span class="toast-message">
      ${escapeHtml(message)}
    </span>

    <button
      class="toast-close"
      onclick="this.parentElement.remove()"
    >
      <i class="fas fa-times"></i>
    </button>
  `;

  container.appendChild(toast);

  // AUTO REMOVE
  setTimeout(() => {

    toast.style.animation =
      'slideInRight 0.3s ease reverse';

    setTimeout(() => {
      toast.remove();
    }, 300);

  }, 4000);
}

// ==========================================
// ESCAPE HTML
// ==========================================
function escapeHtml(text) {

  if (!text) return '';

  const div = document.createElement('div');

  div.textContent = text;

  return div.innerHTML;
}

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================
window.onerror = function (
  msg,
  url,
  lineNo,
  columnNo,
  error
) {

  console.error(
    '[Global Error]',
    msg,
    url,
    lineNo,
    columnNo,
    error
  );

  return false;
};

// ==========================================
// UNHANDLED PROMISE
// ==========================================
window.addEventListener(
  'unhandledrejection',
  function (event) {

    console.error(
      '[Unhandled Promise Rejection]',
      event.reason
    );
  }
);