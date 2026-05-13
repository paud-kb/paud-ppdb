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

    renderSchoolDropdown(data);

  } catch (error) {

    console.error('[App] Error loading schools:', error);

    schoolGridLoading.style.display = 'none';

    errorState.style.display = 'block';

    document.getElementById('errorMessage').textContent =
      error.message || 'Gagal mengambil data sekolah.';
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
// SEARCH SCHOOL
// ==========================================
function initSchoolSearch() {

  if (!schoolSearchInput || !schoolSelect) return;

  schoolSearchInput.addEventListener('input', function () {

    const keyword = this.value.toLowerCase().trim();

    const filteredSchools = schoolsData.filter((school) => {

      const nama = (school.nama_sekolah || '').toLowerCase();
      const npsn = (school.npsn || '').toLowerCase();

      return (
        nama.includes(keyword) ||
        npsn.includes(keyword)
      );
    });

    renderSchoolDropdown(filteredSchools);
  });

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