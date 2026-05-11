// ==========================================
// GLOBAL STATE
// ==========================================
import { supabaseClient } from '../config/supabase.js'
import '../css/style1.css';

const AppState = {
  npsn: null,
  schoolName: null,
  files: {
    kk: null,     // Original File object
    akta: null   // Original File object
  },
  compressedFiles: {
    kk: null,     // Compressed Blob
    akta: null   // Compressed Blob
  },
  isSubmitting: false
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
  console.log('[PPDB] Initializing form...');
  
  // Get NPSN from URL or sessionStorage
  const urlParams = new URLSearchParams(window.location.search);
  AppState.npsn = urlParams.get('npsn') || sessionStorage.getItem('selectedNPSN');
  AppState.schoolName = sessionStorage.getItem('selectedSchoolName');
  
  if (!AppState.npsn) {
    showToast('NPSN tidak ditemukan. Silakan pilih sekolah kembali.', 'error');
    setTimeout(() => window.location.href = 'index.html', 2000);
    return;
  }
  
  // Display school info
  updateSchoolInfo();
  
  // Setup form handlers
  setupFormHandlers();
  setupScrollProgress();
  
  console.log('[PPDB] Ready for school:', AppState.npsn);
});

// ==========================================
// UPDATE SCHOOL INFO BAR
// ==========================================
function updateSchoolInfo() {
  const nameEl = document.getElementById('displaySchoolName');
  const npsnEl = document.getElementById('displayNPSN');
  
  if (AppState.schoolName) {
    nameEl.textContent = AppState.schoolName;
  } else {
    nameEl.textContent = 'Memuat nama sekolah...';
    // Try to fetch from Supabase
    fetchSchoolName(AppState.npsn);
  }
  
  if (AppState.npsn) {
    npsnEl.textContent = `NPSN: ${AppState.npsn}`;
  }
}

async function fetchSchoolName(npsn) {
  try {
    const { data, error } = await supabaseClient
      .from('schools')
      .select('nama_sekolah')
      .eq('npsn', npsn)
      .single();
    
    if (data) {
      document.getElementById('displaySchoolName').textContent = data.nama_sekolah;
      AppState.schoolName = data.nama_sekolah;
    }
  } catch (e) {
    console.warn('[PPDB] Could not fetch school name:', e.message);
  }
}

// ==========================================
// FORM HANDLERS
// ==========================================
function setupFormHandlers() {
  const form = document.getElementById('ppdbForm');
  const submitBtn = document.getElementById('submitBtn');
  
  form.addEventListener('submit', handleFormSubmit);
  
  // Validate agreement checkbox
  const agreeCheck = document.getElementById('agreeCheck');
  agreeCheck.addEventListener('change', () => {
    if (!agreeCheck.checked) {
      agreeCheck.parentElement.style.color = '';
    }
  });
}

function setupScrollProgress() {
  const sections = document.querySelectorAll('.form-section[data-section]');
  const steps = document.querySelectorAll('.progress-step');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const sectionNum = entry.target.dataset.section;
        
        // Update progress steps
        steps.forEach((step, idx) => {
          const stepNum = parseInt(step.id.replace('step', ''));
          if (stepNum < sectionNum) {
            step.classList.add('completed');
            step.classList.remove('active');
          } else if (stepNum === sectionNum) {
            step.classList.add('active');
            step.classList.remove('completed');
          } else {
            step.classList.remove('active', 'completed');
          }
        });
      }
    });
  }, { threshold: 0.3 });
  
  sections.forEach(section => observer.observe(section));
}

// ==========================================
// PEKERJAAN CHANGE HANDLER (Auto-set penghasilan = 0)
// ==========================================
function handlePekerjaanChange(parentType, value) {
  const group = parentType === 'ibu' ? 'penghasilanIbuGroup' : 'penghasilanAyahGroup';
  const input = document.getElementById(parentType === 'ibu' ? 'penghasilan_ibu_per_bulan' : 'penghasilan_ayah_per_bulan');
  
  if (value === 'Tidak Bekerja' || value === 'Meninggal') {
    input.value = '0';
    input.disabled = true;
    input.style.background = '#F5F5F5';
    input.style.color = '#999';
    showToast(`Penghasilan ${parentType.charAt(0).toUpperCase() + parentType.slice(1)} otomatis Rp 0`, 'info');
  } else {
    input.disabled = false;
    input.style.background = '';
    input.style.color = '';
    input.placeholder = 'Contoh: 5000000';
  }
}

// ==========================================
// WALI TOGGLE
// ==========================================
function toggleWaliSection() {
  const checkbox = document.getElementById('ada_wali');
  const section = document.getElementById('waliSection');
  
  if (checkbox.checked) {
    section.classList.add('active');
  } else {
    section.classList.remove('active');
  }
}

function getDocSuffix(docType) {
  return docType === 'kk' ? 'KK' : 'Akta';
}

/**
 * Handle file selection from input
 */
window.handleFileSelect = function(input, docType) {
  const file = input.files[0];
  
  if (!file) return;
  
  console.log(`[Upload] Selected ${docType}:`, file.name, `${(file.size / 1024).toFixed(2)} KB`);
  
  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    showToast('Format file tidak valid! Gunakan JPG, PNG, atau WebP.', 'error');
    resetUploadBox(docType);
    return;
  }
  
  // Validate file size (max 5MB original)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    showToast('File terlalu besar! Maksimal ukuran file adalah 5MB.', 'error');
    resetUploadBox(docType);
    return;
  }
  
  // Store original file
  AppState.files[docType] = file;
  
  // Show preview
  showPreview(file, docType);
}

/**
 * Show image preview in the upload box
 */
async function showPreview(file, docType) {
  const box = document.getElementById(`uploadBox${getDocSuffix(docType)}`);
  const previewContainer = document.getElementById(`preview${getDocSuffix(docType)}`);
  const imgElement = document.getElementById(`imgPreview${getDocSuffix(docType)}`);
  const fileInfo = document.getElementById(`fileInfo${getDocSuffix(docType)}`);
  const icon = document.getElementById(`icon${getDocSuffix(docType)}`);
  const subtitle = document.getElementById(`sub${getDocSuffix(docType)}`);
  const btn = document.getElementById(`btn${getDocSuffix(docType)}`);
  
  try {
    // Create object URL for preview
    const objectUrl = URL.createObjectURL(file);
    imgElement.onload = () => {
      URL.revokeObjectURL(objectUrl);
    };

    imgElement.src = objectUrl;
    
    // Update UI
    box.classList.add('has-file');
    box.classList.remove('error');
    previewContainer.classList.add('show');
    
    icon.innerHTML = '✅';
    icon.style.fontSize = '2rem';
    subtitle.style.display = 'none';
    btn.innerHTML = '<i class="fas fa-check"></i> File Dipilih';
    
    // Show file info
    const sizeKB = (file.size / 1024).toFixed(1);
    fileInfo.innerHTML = `
      <strong>${escapeHtml(file.name)}</strong><br>
      Ukuran asli: ${sizeKB} KB | 
      <span class="size-warn">Akan di-compress → max 200KB saat submit</span>
    `;
    
    console.log(`[Preview] ${docType} shown, original size: ${sizeKB} KB`);
    
  } catch (e) {
    console.error('[Preview] Error:', e);
    showToast('Gagal menampilkan preview gambar.', 'error');
  }
}

/**
 * Remove uploaded file
 */
window.removeFile = function(docType) {
  // Reset state
  AppState.files[docType] = null;
  AppState.compressedFiles[docType] = null;
  
  // Reset input
  const input = document.getElementById(`input${getDocSuffix(docType)}`);
  input.value = '';
  
  // Reset UI
  resetUploadBox(docType);
  
  console.log(`[Upload] ${docType} removed`);
}

function resetUploadBox(docType) {
  const box = document.getElementById(`uploadBox${getDocSuffix(docType)}`);
  const previewContainer = document.getElementById(`preview${getDocSuffix(docType)}`);
  const imgElement = document.getElementById(`imgPreview${getDocSuffix(docType)}`);
  const fileInfo = document.getElementById(`fileInfo${getDocSuffix(docType)}`);
  const icon = document.getElementById(`icon${getDocSuffix(docType)}`);
  const subtitle = document.getElementById(`sub${getDocSuffix(docType)}`);
  const btn = document.getElementById(`btn${getDocSuffix(docType)}`);
  
  box.classList.remove('has-file', 'error');
  previewContainer.classList.remove('show');
  
  // Reset icon based on type
  if (docType === 'kk') {
    icon.innerHTML = '📄';
    subtitle.textContent = 'Klik untuk unggah foto KK';
  } else {
    icon.innerHTML = '📜';
    subtitle.textContent = 'Klik untuk unggah foto Akta';
  }
  icon.style.fontSize = '';
  subtitle.style.display = '';
  
  btn.innerHTML = '<i class="fas fa-upload"></i> Pilih File';
  fileInfo.innerHTML = '';
  
  // Revoke object URL to free memory
  if (imgElement.src && imgElement.src.startsWith('blob:')) {
    URL.revokeObjectURL(imgElement.src);
  }
  imgElement.src = '';
}

// ==========================================
// IMAGE COMPRESSION (Max 200KB)
// ==========================================

/**
 * Compress image to target size using Canvas API
 * @param {File} file - Original image file
 * @param {number} maxSizeKB - Target max size in KB (default 200)
 * @returns {Promise<Blob>} Compressed image blob
 */
async function compressImage(file, maxSizeKB = 200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = function(event) {
      const img = new Image();
      
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Max dimensions (reasonable for documents)
        const MAX_WIDTH = 1500;
        const MAX_HEIGHT = 1500;
        
        let width = img.width;
        let height = img.height;
        
        // Resize if too large
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          if (width > height) {
            height = (height * MAX_WIDTH) / width;
            width = MAX_WIDTH;
          } else {
            width = (width * MAX_HEIGHT) / height;
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Start with high quality
        let quality = 0.85;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        
        // Reduce quality until under target size
        const targetBytes = maxSizeKB * 1024;
        
        while ((dataUrl.length * 0.75) > targetBytes && quality > 0.1) {
          quality -= 0.05;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        
        // Convert base64 to Blob
        const byteString = atob(dataUrl.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        
        const blob = new Blob([ia], { type: 'image/jpeg' });
        
        console.log(`[Compress] ${(file.size/1024).toFixed(1)}KB → ${(blob.size/1024).toFixed(1)}KB (quality: ${(quality*100).toFixed(0)}%)`);
        
        resolve(blob);
      };
      
      img.onerror = function() {
        reject(new Error('Failed to load image'));
      };
      
      img.src = event.target.result;
    };
    
    reader.onerror = function() {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Compress both files (KK & Akta)
 */
async function compressAllFiles() {
  const results = {};
  
  if (AppState.files.kk) {
    try {
      results.kk = await compressImage(AppState.files.kk, 200);
      AppState.compressedFiles.kk = results.kk;
    } catch (e) {
      throw new Error(`Gagal compress dokumen KK: ${e.message}`);
    }
  }
  
  if (AppState.files.akta) {
    try {
      results.akta = await compressImage(AppState.files.akta, 200);
      AppState.compressedFiles.akta = results.akta;
    } catch (e) {
      throw new Error(`Gagal compress dokumen Akta: ${e.message}`);
    }
  }
  
  return results;
}

// ==========================================
// UPLOAD TO SUPABASE STORAGE
// ==========================================

/**
 * Upload compressed file to Supabase Storage
 * Path format: npsn-banjar/{npsn}/{registrationId}_{type}.jpg
 */
async function uploadToStorage(compressedBlob, studentName, docType) {
  const ext = 'jpg';

  const cleanName = studentName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const timestamp = Date.now();
  const fileName =
    `${cleanName}-${docType}-${timestamp}.${ext}`;
  const filePath = `${AppState.npsn}/${fileName}`;
  console.log(`[Storage] Uploading to: ${filePath}`);
  console.log(`[Storage] Blob size: ${(compressedBlob.size / 1024).toFixed(1)}KB`);
  
  const { data, error } = await supabaseClient.storage
    .from('npsn-banjar')
    .upload(filePath, compressedBlob, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'image/jpeg'
    });
  
  if (error) {
    console.error('[Storage] Upload error:', error);
    throw new Error(`Gagal upload ${docType.toUpperCase()}: ${error.message}`);
  }
  
  console.log(`[Storage] ✅ Uploaded: ${filePath}`);
  return filePath;
}

// ✅ PERBAIKAN: Biarkan trigger DB generate nomor_pendaftaran
async function handleFormSubmit(e) {
  e.preventDefault();
  
  if (AppState.isSubmitting) return;
  
  // Validasi agreement
  const agreeCheck = document.getElementById('agreeCheck');
  if (!agreeCheck.checked) {
    agreeCheck.parentElement.style.color = '#EF5350';
    agreeCheck.focus();
    showToast('Silakan centang pernyataan kebenaran data.', 'warning');
    return;
  }
  
  // Validasi required fields
  const namaLengkap = document.getElementById('nama_lengkap').value.trim();
  const jenisKelamin = document.getElementById('jenis_kelamin').value;
  const alamat = document.getElementById('alamat').value.trim();
  const namaIbu = document.getElementById('nama_ibu_kandung').value.trim();
  const noHpIbu = document.getElementById('no_hp_ibu').value.trim();
  
  if (!namaLengkap || !jenisKelamin || !alamat || !namaIbu || !noHpIbu) {
    showToast('Mohon lengkapi semua field wajib (bertanda *).', 'warning');
    scrollToFirstError();
    return;
  }
  
  // Validasi dokumen (opsional tapi direkomendasikan)
  if (!AppState.files.kk && !AppState.files.akta) {
    const confirmUpload = confirm(
      'Anda belum mengunggah dokumen KK maupun Akta.\n\n' +
      'Dokumen sangat disarankan untuk kelengkapan data.\n\n' +
      'Lanjutkan tanpa mengunggah dokumen?'
    );
    if (!confirmUpload) return;
  }
  
  // Start submission
  AppState.isSubmitting = true;
  updateSubmitButton(true);
  
  try {
    // Step 1: Collect form data
    const formData = collectFormData();
    console.log('[Submit] Form data collected:', formData);
    
    // ⚠️ HAPUS: Tidak perlu generate UUID manual lagi
    // Trigger DB (trigger_nomor_pendaftaran) akan auto-generate
    
    // Step 2: Compress files
    showToast('Mengompres gambar...', 'info');
    await compressAllFiles();
    
    // Step 3: Upload files to storage
    let urlKK = null;
    let urlAkta = null;
    
    if (AppState.compressedFiles.kk) {
      showToast('Mengunggah Kartu Keluarga...', 'info');
      urlKK = await uploadToStorage(
        AppState.compressedFiles.kk,
        formData.nama_lengkap,
        'kk'
      );
    }
    
    if (AppState.compressedFiles.akta) {
      showToast('Mengunggah Akta Kelahiran...', 'info');
      urlAkta = await uploadToStorage(
        AppState.compressedFiles.akta,
        formData.nama_lengkap,
        'akta'
      );
    }
    
    // Step 4: Save to database (TANPA nomor_pendaftaran manual)
    showToast('Menyimpan data pendaftaran...', 'info');
    
    const saveData = {
      ...formData,
      npsn: AppState.npsn,
      url_kk: urlKK,
      url_akta: urlAkta
      // ❌ Jangan kirim nomor_pendaftaran, biar trigger DB isi
      // ❌ Jangan kirim id, biar gen_random_uuid() yang handle
    };
    
    console.log('[Submit] Saving to DB:', saveData);
    
    const { data: insertedData, error: insertError } = await supabaseClient
      .from('registrations')
      .insert(saveData)
      .select('nomor_pendaftaran') // ← AMBIL HASIL DARI TRIGGER
      .single();
    
    if (insertError) throw insertError;
    
    console.log('[Submit] ✅ Registration saved!');
    console.log('[Submit] Nomor Pendaftaran (dari trigger):', insertedData.nomor_pendaftaran);
    
    // Step 5: Show success modal dengan nomor dari DB
    showSuccessModal(insertedData.nomor_pendaftaran);
    
  } catch (error) {
    console.error('[Submit] Error:', error);
    showToast(error.message || 'Gagal menyimpan data. Silakan coba lagi.', 'error');
    AppState.isSubmitting = false;
    updateSubmitButton(false);
  }
}

// ==========================================
// COLLECT FORM DATA
// ==========================================
function collectFormData() {
  const getVal = (id) => document.getElementById(id)?.value?.trim() || '';
  const getNumVal = (id) => {
    const val = document.getElementById(id)?.value;
    return val !== '' && val !== null ? parseFloat(val) : null;
  };
  
  return {
    // Siswa
    nama_lengkap: getVal('nama_lengkap'),
    nik: getVal('nik') || null,
    jenis_kelamin: document.getElementById('jenis_kelamin').value,
    tempat_lahir: getVal('tempat_lahir') || null,
    tanggal_lahir: getVal('tanggal_lahir') || null,
    agama: document.getElementById('agama').value,
    kewarganegaraan: getVal('kewarganegaraan') || 'WNI',
    
    // Alamat
    alamat: getVal('alamat'),
    rt: getVal('rt') || null,
    rw: getVal('rw') || null,
    kode_pos: getVal('kode_pos') || null,
    kelurahan: getVal('kelurahan') || null,
    kecamatan: getVal('kecamatan') || null,
    kabupaten_kota: getVal('kabupaten_kota') || null,
    provinsi: getVal('provinsi') || 'Jawa Barat',
    tinggal_bersama: document.getElementById('tinggal_bersama').value,
    jenis_tinggal: document.getElementById('jenis_tinggal').value,
    moda_transportasi: document.getElementById('moda_transportasi').value,
    jarak_tempuh_m: getNumVal('jarak_tempuh_m'),
    
    // Ibu
    nama_ibu_kandung: getVal('nama_ibu_kandung'),
    tahun_lahir_ibu: getNumVal('tahun_lahir_ibu'),
    nik_ibu: getVal('nik_ibu') || null,
    pendidikan_ibu: document.getElementById('pendidikan_ibu').value || null,
    pekerjaan_ibu: document.getElementById('pekerjaan_ibu').value || null,
    penghasilan_ibu_per_bulan: getNumVal('penghasilan_ibu_per_bulan') || 0,
    no_hp_ibu: getVal('no_hp_ibu'),
    
    // Ayah
    nama_ayah: getVal('nama_ayah') || null,
    tahun_lahir_ayah: getNumVal('tahun_lahir_ayah'),
    nik_ayah: getVal('nik_ayah') || null,
    pendidikan_ayah: document.getElementById('pendidikan_ayah').value || null,
    pekerjaan_ayah: document.getElementById('pekerjaan_ayah').value || null,
    penghasilan_ayah_per_bulan: getNumVal('penghasilan_ayah_per_bulan') || 0,
    no_hp_ayah: getVal('no_hp_ayah') || null,
    
    // Wali
    ada_wali: document.getElementById('ada_wali').checked,
    nama_wali: getVal('nama_wali') || null,
    hubungan_wali: getVal('hubungan_wali') || null,
    pekerjaan_wali: getVal('pekerjaan_wali') || null,
    penghasilan_wali_per_bulan: null, // Optional, not in form
    no_hp_wali: getVal('no_hp_wali') || null,
    tahun_lahir_wali: getNumVal('tahun_lahir_wali'),
    
    // Fisik
    berat_badan_kg: getNumVal('berat_badan_kg'),
    tinggi_badan_cm: getNumVal('tinggi_badan_cm')
  };
}

// ==========================================
// UI HELPERS
// ==========================================

function updateSubmitButton(isLoading) {
  const btn = document.getElementById('submitBtn');
  
  if (isLoading) {
    btn.disabled = true;
    btn.classList.add('loading');
    btn.innerHTML = '<div class="spinner"></div><span>Memproses...</span>';
  } else {
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.innerHTML = '<i class="fas fa-paper-plane"></i><span>Kirim Pendaftaran</span>';
  }
}

function showSuccessModal(nomorPendaftaran) {
  const modal = document.getElementById('successModal');
  const regDisplay = document.getElementById('regNumberDisplay');
  
  regDisplay.textContent = nomorPendaftaran;
  modal.classList.add('show');
  
  // Disable body scroll
  document.body.style.overflow = 'hidden';
}

function scrollToFirstError() {
  const firstInvalid = document.querySelector(':invalid');
  if (firstInvalid) {
    firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    firstInvalid.focus();
  }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function generateUUID() {
  // Generate UUID v4-like string
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  }).toUpperCase();
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Toast notification (reuse from app.js pattern)
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-check-circle';
  if (type === 'error') icon = 'fa-exclamation-circle';
  if (type === 'warning') icon = 'fa-exclamation-triangle';

  toast.innerHTML = `
    <i class="fas ${icon} toast-icon"></i>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <i class="fas fa-times"></i>
    </button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}
