// API Configuration
const WEBHOOK_URL = 'https://primary-production-7d413.up.railway.app/webhook/promed';

let canvas;
let ctx;
let isDrawing = false;
let hasSignature = false;

document.addEventListener('DOMContentLoaded', function () {
  console.log('SCRIPT_VERSION_2026_07_27_MODAL');
  initializeCanvas();
  initializeForm();

  const saveBtn = document.getElementById('saveSignature');
  if (saveBtn) saveBtn.disabled = false;

  hideSignatureStatus();
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

// ===== Submit =====
async function handleSubmit(e) {
  e.preventDefault();

  if (!validateAllFields()) {
    alert('Пожалуйста, исправьте ошибки в форме');
    return;
  }

  const submitBtn = document.querySelector('.btn-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Отправка...';

  try {
    const formData = {
      fio: document.getElementById('fio').value.trim(),
      birthdate: document.getElementById('birthdate').value.trim(),
      gender: document.getElementById('gender').value,
      iin: document.getElementById('iin').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      allergy: document.getElementById('allergy').value.trim(),
      procedures: document.getElementById('procedures').value.trim()
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
