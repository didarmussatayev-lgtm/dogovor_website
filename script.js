// API Configuration
const GOOGLE_CLIENT_ID = '387713201223-raigbff4jiftmkkjt3o2volh5nl20b3h.apps.googleusercontent.com';
const GOOGLE_API_KEY = 'AIzaSyDCvcM08kZDIUT2WyEgg6tgK4WXJ--aIFU';
const SCOPES = 'https://www.googleapis.com/auth/drive';
const WEBHOOK_URL = 'https://didarmussatayev-lgtm.github.io/dogovor_website/';
// Production webhook URL (uncomment to use):
// const WEBHOOK_URL = 'https://didarmussatayev-lgtm.github.io/dogovor_website/';

// Shared Google Drive folder ID
const SHARED_FOLDER_ID = '1am2_QQ70rJ03PdTG5Oj1P7DzxEcMhhqt';

// Google API state
let gapiInited = false;
let gisInited = false;
let tokenClient;
let accessToken = null;
let driveAuthenticated = false;

main
let canvas;
let ctx;
let isDrawing = false;
let hasSignature = false;

// Download flow state
let submissionState = 'idle'; // 'idle' | 'submitting' | 'polling' | 'not_found'
let pendingFileName = null;

// Polling settings: up to 20 attempts × 3 s = 60 s total
const POLLING_MAX_ATTEMPTS = 20;
const POLLING_INTERVAL_MS = 3000;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeCanvas();
    initializeForm();
    
    // Enable the save button (no longer need Google API initialization)
    const saveBtn = document.getElementById('saveSignature');
    saveBtn.disabled = false;
    console.log('✓ Ready to save signatures to server');
main
});

// ===== Canvas =====
function initializeCanvas() {
  canvas = document.getElementById('signatureCanvas');
  if (!canvas) return;

  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);

  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  canvas.addEventListener('touchend', stopDrawing);

  document.getElementById('clearSignature')?.addEventListener('click', clearSignature);
  document.getElementById('saveSignature')?.addEventListener('click', handleSaveSignature);
  document.getElementById('downloadSignature')?.addEventListener('click', downloadSignature);

  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function resizeCanvas() {
  if (!canvas || !ctx) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function startDrawing(e) {
  isDrawing = true;
  const rect = canvas.getBoundingClientRect();
  ctx.beginPath();
  ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  hasSignature = true;
}
function draw(e) {
  if (!isDrawing) return;
  const rect = canvas.getBoundingClientRect();
  ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
  ctx.stroke();
}
function stopDrawing() { isDrawing = false; }

function handleTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  isDrawing = true;
  ctx.beginPath();
  ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
  hasSignature = true;
}
function handleTouchMove(e) {
  if (!isDrawing) return;
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
  ctx.stroke();
}

function clearSignature() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  hasSignature = false;
  document.getElementById('signature-error').textContent = '';
  hideSignatureStatus();

  const saveBtn = document.getElementById('saveSignature');
  if (saveBtn) {
    saveBtn.textContent = 'Сохранить подпись';
    saveBtn.disabled = false;
  }
}

function downloadSignature() {
  if (!hasSignature) {
    showSignatureStatus('Пожалуйста, нарисуйте подпись перед загрузкой', 'error');
    return;
  }

  const iin = document.getElementById('iin')?.value.trim();
  const filename = iin ? `signature_${iin}.png` : 'signature.png';

  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showSignatureStatus(`✓ Подпись сохранена как ${filename}`, 'success');
  }, 'image/png');
}

function handleSaveSignature() {
  const saveBtn = document.getElementById('saveSignature');
  if (!hasSignature) {
    showSignatureStatus('Пожалуйста, нарисуйте подпись перед сохранением', 'error');
    return;
  }
  if (saveBtn) {
    saveBtn.textContent = 'Сохранено';
    saveBtn.disabled = true;
  }
  showSignatureStatus('✓ Подпись готова к отправке', 'success');
}

function showSignatureStatus(message, type) {
  const statusDiv = document.getElementById('signature-status');
  if (!statusDiv) return;
  statusDiv.style.display = 'block';
  statusDiv.textContent = message;
  statusDiv.className = `signature-status ${type}`;
}
function hideSignatureStatus() {
  const statusDiv = document.getElementById('signature-status');
  if (!statusDiv) return;
  statusDiv.style.display = 'none';
  statusDiv.textContent = '';
  statusDiv.className = 'signature-status';
}

// ===== Validation =====
function initializeForm() {
  const form = document.getElementById('consentForm');
  if (!form) return;

  document.getElementById('phone')?.addEventListener('input', validatePhone);
  document.getElementById('iin')?.addEventListener('input', validateIIN);
  document.getElementById('birthdate')?.addEventListener('input', formatBirthdate);
  document.getElementById('fio')?.addEventListener('input', validateFIO);

  form.addEventListener('submit', handleSubmit);
}

function validateFIO() {
  const fioInput = document.getElementById('fio');
  const fioError = document.getElementById('fio-error');
  const fio = fioInput.value.trim();
  if (!fio) { fioError.textContent = ''; fioInput.classList.remove('error'); return false; }

  const nameRegex = /^[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі\s\-]+$/;
  if (!nameRegex.test(fio)) {
    fioError.textContent = 'ФИО должно содержать только русские или казахские буквы';
    fioInput.classList.add('error');
    return false;
  }
  fioError.textContent = '';
  fioInput.classList.remove('error');
  return true;
}

function validatePhone() {
  const input = document.getElementById('phone');
  const error = document.getElementById('phone-error');
  const value = input.value.trim();
  if (!value) { error.textContent = ''; input.classList.remove('error'); return false; }

  if (!/^(\+7|8)\d{10}$/.test(value)) {
    error.textContent = 'Телефон должен начинаться с +7 или 8 и содержать 10 цифр';
    input.classList.add('error');
    return false;
  }
  error.textContent = '';
  input.classList.remove('error');
  return true;
}

function validateIIN() {
  const input = document.getElementById('iin');
  const error = document.getElementById('iin-error');
  const value = input.value.trim();
  if (!value) { error.textContent = ''; input.classList.remove('error'); return false; }

  if (!/^\d{12}$/.test(value)) {
    error.textContent = 'ИИН должен содержать ровно 12 цифр';
    input.classList.add('error');
    return false;
  }
  error.textContent = '';
  input.classList.remove('error');
  return true;
}

function formatBirthdate() {
  const input = document.getElementById('birthdate');
  let value = input.value.replace(/\D/g, '');
  if (value.length >= 2) value = value.slice(0, 2) + '/' + value.slice(2);
  if (value.length >= 5) value = value.slice(0, 5) + '/' + value.slice(5, 9);
  input.value = value;
  validateBirthdate();
}

function validateBirthdate() {
  const input = document.getElementById('birthdate');
  const error = document.getElementById('birthdate-error');
  const v = input.value.trim();

  if (!v) { error.textContent = ''; input.classList.remove('error'); return false; }

  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) {
    error.textContent = 'Формат: дд/мм/гггг';
    input.classList.add('error');
    return false;
  }
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > new Date().getFullYear()) {
    error.textContent = 'Некорректная дата';
    input.classList.add('error');
    return false;
  }
  error.textContent = '';
  input.classList.remove('error');
  return true;
}

function validateAllFields() {
  let ok = true;

  if (!validateFIO()) {
    const el = document.getElementById('fio');
    if (!el.value.trim()) document.getElementById('fio-error').textContent = 'Пожалуйста, введите ФИО';
    el.classList.add('error');
    ok = false;
  }

  if (!validateBirthdate()) {
    const el = document.getElementById('birthdate');
    if (!el.value.trim()) document.getElementById('birthdate-error').textContent = 'Пожалуйста, введите дату рождения';
    ok = false;
  }

  const gender = document.getElementById('gender');
  const genderError = document.getElementById('gender-error');
  if (!gender.value) { genderError.textContent = 'Пожалуйста, выберите пол'; gender.classList.add('error'); ok = false; }
  else { genderError.textContent = ''; gender.classList.remove('error'); }

  if (!validateIIN()) {
    const el = document.getElementById('iin');
    if (!el.value.trim()) document.getElementById('iin-error').textContent = 'Пожалуйста, введите ИИН';
    ok = false;
  }

  if (!validatePhone()) {
    const el = document.getElementById('phone');
    if (!el.value.trim()) document.getElementById('phone-error').textContent = 'Пожалуйста, введите телефон';
    ok = false;
  }

  const allergy = document.getElementById('allergy');
  if (!allergy.value.trim()) {
    document.getElementById('allergy-error').textContent = 'Пожалуйста, заполните это поле (или напишите НЕТ)';
    allergy.classList.add('error');
    ok = false;
  } else {
    document.getElementById('allergy-error').textContent = '';
    allergy.classList.remove('error');
  }

  const procedures = document.getElementById('procedures');
  if (!procedures.value.trim()) {
    document.getElementById('procedures-error').textContent = 'Пожалуйста, заполните это поле (или напишите НЕТ)';
    procedures.classList.add('error');
    ok = false;
  } else {
    document.getElementById('procedures-error').textContent = '';
    procedures.classList.remove('error');
  }

  const sigError = document.getElementById('signature-error');
  if (!hasSignature) { sigError.textContent = 'Пожалуйста, нарисуйте вашу подпись'; ok = false; }
  else sigError.textContent = '';

  return ok;
}

// ===== Modal + Download =====
function showDownloadModal() {
  const m = document.getElementById('downloadModal');
  if (m) m.style.display = 'flex';
}
function hideDownloadModal() {
  const m = document.getElementById('downloadModal');
  if (m) m.style.display = 'none';
}
function startDirectDownload(downloadUrl) {
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
async function waitUntilFileReadyAndDownload(downloadUrl, timeoutMs = 120000, intervalMs = 3000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(downloadUrl, { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        startDirectDownload(downloadUrl);
        return true;
      }
    } catch (_) {}
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

// Search for a file by exact name in the shared Google Drive folder using the public API key
async function searchDriveFile(fileName) {
    const query = `name='${fileName}' and '${SHARED_FOLDER_ID}' in parents and trashed=false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&key=${GOOGLE_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `HTTP ${response.status}`);
    }
    const data = await response.json();
    return (data.files && data.files.length > 0) ? data.files[0] : null;
}

// Poll Google Drive until the file appears or the attempt limit is reached
async function pollForFile(fileName, onStatusUpdate) {
    for (let attempt = 1; attempt <= POLLING_MAX_ATTEMPTS; attempt++) {
        onStatusUpdate(`Ищем документ… (${attempt}/${POLLING_MAX_ATTEMPTS})`);
        try {
            const file = await searchDriveFile(fileName);
            if (file) return file;
        } catch (err) {
            console.warn(`Polling attempt ${attempt} failed:`, err);
        }
        if (attempt < POLLING_MAX_ATTEMPTS) {
            await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
        }
    }
    return null;
}

// Trigger browser download of the found file from Google Drive
function downloadFileFromDrive(fileId, fileName) {
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Poll Drive for the pending file and download it when found
async function pollAndDownload(submitBtn, fileName) {
    submissionState = 'polling';
    submitBtn.disabled = true;

    const file = await pollForFile(fileName, (status) => {
        submitBtn.textContent = status;
    });

    if (file) {
        downloadFileFromDrive(file.id, fileName);

        // Reset form for the next user
        document.getElementById('consentForm').reset();
        clearSignature();

        submissionState = 'idle';
        pendingFileName = null;
        submitBtn.textContent = 'Скачать соглашение';
        submitBtn.disabled = false;
    } else {
        submissionState = 'not_found';
        submitBtn.textContent = 'Документ ещё не готов — нажмите для повтора';
        submitBtn.disabled = false;
    }
}

// Handle form submission
async function handleSubmit(e) {
    e.preventDefault();

    const submitBtn = document.querySelector('.btn-submit');

    // If a previous attempt timed out, retry polling without re-submitting the form
    if (submissionState === 'not_found' && pendingFileName) {
        await pollAndDownload(submitBtn, pendingFileName);
        return;
    }

    if (submissionState !== 'idle') return;

    if (!validateAllFields()) {
        alert('Пожалуйста, исправьте ошибки в форме');
        return;
    }

    const iin = document.getElementById('iin').value.trim();
    const fio = document.getElementById('fio').value.trim();
    pendingFileName = `${iin},${fio}.pdf`;

    submissionState = 'submitting';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправляем данные…';

    try {
        const formData = {
            fio: fio,
            birthdate: document.getElementById('birthdate').value,
            gender: document.getElementById('gender').value,
            iin: iin,
            phone: document.getElementById('phone').value.trim(),
            allergy: document.getElementById('allergy').value.trim(),
            procedures: document.getElementById('procedures').value.trim()
        };

        // Send data and signature to webhook
        await sendToWebhook(formData);

        // Then poll Google Drive until the generated PDF appears
        await pollAndDownload(submitBtn, pendingFileName);

    } catch (error) {
        console.error('Error:', error);
        alert('Произошла ошибка при отправке: ' + error.message);
        submissionState = 'idle';
        pendingFileName = null;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Скачать соглашение';
    }
}
function setFinalButtonAsDownload(docName, fileId) {
    const btn = document.querySelector('.btn-submit');
    btn.type = 'button';
    btn.disabled = false;
    btn.textContent = 'Скачать соглашение';
    btn.onclick = () => {
        downloadDriveFile(fileId, docName).catch(err => {
            console.error(err);
            alert('Не удалось скачать документ: ' + err.message);
        });
main
    };

    const webhookResult = await sendToWebhook(formData);
    if (!webhookResult?.downloadUrl) throw new Error('n8n не вернул downloadUrl');

    submitBtn.disabled = false;
    submitBtn.textContent = 'Скачать соглашение';

    submitBtn.onclick = async () => {
      showDownloadModal();
      const ready = await waitUntilFileReadyAndDownload(webhookResult.downloadUrl, 120000, 3000);
      hideDownloadModal();

      if (!ready) {
        alert('Документ ещё формируется. Попробуйте снова через 20–30 секунд.');
      }
    };
  } catch (error) {
    console.error(error);
    alert('Произошла ошибка: ' + error.message);
    submitBtn.disabled = false;
    submitBtn.textContent = 'ЗАВЕРШИТЬ';
  }
}

async function sendToWebhook(formData) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      try {
        const fd = new FormData();
        fd.append('fio', formData.fio);
        fd.append('birthdate', formData.birthdate);
        fd.append('gender', formData.gender);
        fd.append('iin', formData.iin);
        fd.append('phone', formData.phone);
        fd.append('allergy', formData.allergy);
        fd.append('procedures', formData.procedures);
        fd.append('signature', blob, `${formData.iin}.png`);

        const response = await fetch(WEBHOOK_URL, {
          method: 'POST',
          body: fd
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Ошибка сервера ${response.status}: ${errText}`);
        }

        const result = await response.json();
        resolve(result);
      } catch (err) {
        reject(new Error('Не удалось отправить данные: ' + err.message));
      }
    }, 'image/png');
  });
}
