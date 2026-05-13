// ==========================================
// GLOBAL VARIABLES
// ==========================================
import '../css/style.css';
import { supabase } from '../config/supabase.js';

let selectedSchool = null;
let schoolsData = [];

// ==========================================
// DOM ELEMENTS
// ==========================================
const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileMenu = document.getElementById('mobileMenu');
const menuOverlay = document.getElementById('menuOverlay');

const schoolGrid = document.getElementById('schoolGrid');
const schoolGridLoading = document.getElementById('schoolGridLoading');

const schoolSelect = document.getElementById('schoolSelect');
const schoolSearchInput = document.getElementById('schoolSearchInput');

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
  initSchoolSearch();
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

async function loadSchools() {
  try {
    // 1. Fetch Data (Sesuaikan dengan kode fetch yang kamu punya)
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .is('is_active', true)
      .order('nama_sekolah', { ascending: true });

    if (error) throw error;

    if (data && data.length > 0) {
      schoolsData = data; // Simpan data ke global variable

      // ==========================================
      // TAMBAHKAN BARIS INI (Wajib)
      // ==========================================
      const schoolGrid = document.getElementById('schoolGrid');
      if (schoolGrid) {
        schoolGrid.style.display = 'block'; // Tampilkan kotak pencarian
      }
      // ==========================================

      // 2. Panggil fungsi pencarian baru kita
      initSchoolSearch();
      
      // 3. Sembunyikan Loading Skeleton
      document.getElementById('schoolGridLoading').style.display = 'none';
      
    } else {
      // Tampilkan Empty State jika tidak ada data
      document.getElementById('schoolGridLoading').style.display = 'none';
      document.getElementById('emptyState').style.display = 'block';
    }

  } catch (err) {
    console.error('Gagal memuat sekolah:', err);
    document.getElementById('schoolGridLoading').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
    document.getElementById('errorMessage').textContent = err.message;
  }
}

// ==========================================
// RENDER SCHOOL DROPDOWN
// ==========================================
function renderSchoolDropdown(schools) {

  if (!schoolSelect) return;

  // RESET
  schoolSelect.innerHTML = `
    <option value="">
      -- Pilih Sekolah Tujuan --
    </option>
  `;

  schools.forEach((school) => {

    const option = document.createElement('option');

    option.value = school.npsn;

    option.textContent =
      `${school.nama_sekolah} - NPSN: ${school.npsn}`;

    option.dataset.school = JSON.stringify(school);

    schoolSelect.appendChild(option);
  });

  schoolGrid.style.display = 'block';
}

// ==========================================
// INIT CUSTOM SEARCH SCHOOL
// ==========================================
function initSchoolSearch() {
  const searchInput = document.getElementById('schoolSearchInput');
  const dropdownList = document.getElementById('schoolDropdownList');
  const searchBtn = document.getElementById('btnCariSekolah');
  const lihatBtn = document.getElementById('btnLihatSemua'); // Tombol baru
  
  let inactivityTimer; // Timer 10 detik

  if (!searchInput || !dropdownList) return;

  // Fungsi Reset Timer
  const resetTimer = () => {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      console.log('Auto reset input (10 detik)');
      searchInput.value = '';
      dropdownList.style.display = 'none';
      dropdownList.innerHTML = '';
      if (selectedSchool) showToast('Waktu pencarian habis', 'info');
    }, 10000);
  };

  // Fungsi Filter (LOGIKA UTAMA DIUBAH DISINI)
  const filterSchools = (keyword) => {
    dropdownList.innerHTML = ''; 

    // Jika keyword kosong, TAMPILKAN SEMUA (Jangan sembunyikan)
    const keywordLower = keyword.toLowerCase();
    
    // Cari data
    const filtered = schoolsData.filter(school => {
      return (school.nama_sekolah || '').toLowerCase().includes(keywordLower) ||
             (school.npsn || '').includes(keywordLower);
    });

    if (filtered.length === 0) {
      const li = document.createElement('li');
      li.innerHTML = `<span>Tidak ditemukan sekolah dengan kata "${keyword}"</span>`;
      li.style.cursor = 'default';
      dropdownList.appendChild(li);
    } else {
      filtered.forEach(school => {
        const li = document.createElement('li');
        li.innerHTML = `
          <strong>${school.nama_sekolah}</strong>
          <span>NPSN: ${school.npsn}</span>
        `;
        
        li.addEventListener('click', () => {
          searchInput.value = school.nama_sekolah;
          dropdownList.style.display = 'none';
          selectSchool(school);
          clearTimeout(inactivityTimer);
        });

        dropdownList.appendChild(li);
      });
    }

    // Tampilkan dropdown (baik ada hasil atau tidak)
    dropdownList.style.display = 'block';
  };

  // EVENT 1: Mengetik
  searchInput.addEventListener('input', (e) => {
    resetTimer();
    filterSchools(e.target.value);
  });

  // EVENT 2: Tombol "Lihat Daftar" (Baru)
  lihatBtn.addEventListener('click', () => {
    searchInput.value = ''; // Bersihkan input
    searchInput.focus();   // Fokus ke input
    filterSchools('');     // Tampilkan SEMUA data
    resetTimer();          // Reset timer
  });

  // EVENT 3: Tombol Cari
  searchBtn.addEventListener('click', () => {
    resetTimer();
    filterSchools(searchInput.value.trim());
    searchInput.focus();
  });

  // EVENT 4: Klik di luar area
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-search-container')) {
      dropdownList.style.display = 'none';
    }
  });
}

  // SELECT CHANGE
  schoolSelect.addEventListener('change', function () {

    const selectedOption =
      this.options[this.selectedIndex];

    if (!selectedOption.value) {

      selectedSchool = null;

      nextBtn.disabled = true;

      nextBtn.innerHTML = `
        <span>Pilih Sekolah Terlebih Dahulu</span>
        <i class="fas fa-arrow-right"></i>
      `;

      nextButtonContainer.style.display = 'none';

      return;
    }

    const school =
      JSON.parse(selectedOption.dataset.school);

    selectSchool(school);
  });

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
// GO TO REGISTRATION PAGE
// ==========================================
window.goToRegistration = function () {

  if (!selectedSchool) {

    showToast(
      'Silakan pilih sekolah terlebih dahulu',
      'warning'
    );

    return;
  }

  sessionStorage.setItem(
    'selectedNPSN',
    selectedSchool.npsn
  );

  sessionStorage.setItem(
    'selectedSchoolName',
    selectedSchool.nama_sekolah
  );

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