// API Configuration
const WEBHOOK_URL = 'https://primary-production-7d413.up.railway.app/webhook-test/promed';

// Canvas variables
let canvas;
let ctx;
let isDrawing = false;
let hasSignature = false;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    initializeCanvas();
    initializeForm();

    const saveBtn = document.getElementById('saveSignature');
    if (saveBtn) saveBtn.disabled = false;

    hideSignatureStatus();
    console.log('✓ Form ready');
});

// ===== Canvas / Signature =====
function initializeCanvas() {
    canvas = document.getElementById('signatureCanvas');
    if (!canvas) return;

    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // Touch events
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);

    // Buttons
    document.getElementById('clearSignature')?.addEventListener('click', clearSignature);
    document.getElementById('saveSignature')?.addEventListener('click', handleSaveSignature);
    document.getElementById('downloadSignature')?.addEventListener('click', downloadSignature);

    // Draw style
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

function stopDrawing() {
    isDrawing = false;
}

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
        saveBtn.classList.remove('btn-saved');
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
        saveBtn.classList.add('btn-saved');
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

// ===== Form / Validation =====
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

    if (fio === '') {
        fioError.textContent = '';
        fioInput.classList.remove('error');
        return false;
    }

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
    const phoneInput = document.getElementById('phone');
    const phoneError = document.getElementById('phone-error');
    const phone = phoneInput.value.trim();

    if (phone === '') {
        phoneError.textContent = '';
        phoneInput.classList.remove('error');
        return false;
    }

    const phoneRegex = /^(\+7|8)\d{10}$/;
    if (!phoneRegex.test(phone)) {
        phoneError.textContent = 'Телефон должен начинаться с +7 или 8 и содержать 10 цифр';
        phoneInput.classList.add('error');
        return false;
    }

    phoneError.textContent = '';
    phoneInput.classList.remove('error');
    return true;
}

function validateIIN() {
    const iinInput = document.getElementById('iin');
    const iinError = document.getElementById('iin-error');
    const iin = iinInput.value.trim();

    if (iin === '') {
        iinError.textContent = '';
        iinInput.classList.remove('error');
        return false;
    }

    if (!/^\d{12}$/.test(iin)) {
        iinError.textContent = 'ИИН должен содержать ровно 12 цифр';
        iinInput.classList.add('error');
        return false;
    }

    iinError.textContent = '';
    iinInput.classList.remove('error');
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
    const birthdateInput = document.getElementById('birthdate');
    const birthdateError = document.getElementById('birthdate-error');
    const birthdate = birthdateInput.value.trim();

    if (birthdate === '') {
        birthdateError.textContent = '';
        birthdateInput.classList.remove('error');
        return false;
    }

    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = birthdate.match(dateRegex);

    if (!match) {
        birthdateError.textContent = 'Формат: дд/мм/гггг';
        birthdateInput.classList.add('error');
        return false;
    }

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > new Date().getFullYear()) {
        birthdateError.textContent = 'Некорректная дата';
        birthdateInput.classList.add('error');
        return false;
    }

    birthdateError.textContent = '';
    birthdateInput.classList.remove('error');
    return true;
}

function validateAllFields() {
    let isValid = true;

    const fioInput = document.getElementById('fio');
    if (!validateFIO()) {
        if (fioInput.value.trim() === '') {
            document.getElementById('fio-error').textContent = 'Пожалуйста, введите ФИО';
            fioInput.classList.add('error');
        }
        isValid = false;
    }

    if (!validateBirthdate()) {
        const birthdateInput = document.getElementById('birthdate');
        if (birthdateInput.value.trim() === '') {
            document.getElementById('birthdate-error').textContent = 'Пожалуйста, введите дату рождения';
        }
        isValid = false;
    }

    const gender = document.getElementById('gender').value;
    const genderError = document.getElementById('gender-error');
    if (gender === '') {
        genderError.textContent = 'Пожалуйста, выберите пол';
        document.getElementById('gender').classList.add('error');
        isValid = false;
    } else {
        genderError.textContent = '';
        document.getElementById('gender').classList.remove('error');
    }

    if (!validateIIN()) {
        const iinInput = document.getElementById('iin');
        if (iinInput.value.trim() === '') {
            document.getElementById('iin-error').textContent = 'Пожалуйста, введите ИИН';
        }
        isValid = false;
    }

    if (!validatePhone()) {
        const phoneInput = document.getElementById('phone');
        if (phoneInput.value.trim() === '') {
            document.getElementById('phone-error').textContent = 'Пожалуйста, введите телефон';
        }
        isValid = false;
    }

    const allergy = document.getElementById('allergy').value.trim();
    const allergyError = document.getElementById('allergy-error');
    if (allergy === '') {
        allergyError.textContent = 'Пожалуйста, заполните это поле (или напишите НЕТ)';
        document.getElementById('allergy').classList.add('error');
        isValid = false;
    } else {
        allergyError.textContent = '';
        document.getElementById('allergy').classList.remove('error');
    }

    const procedures = document.getElementById('procedures').value.trim();
    const proceduresError = document.getElementById('procedures-error');
    if (procedures === '') {
        proceduresError.textContent = 'Пожалуйста, заполните это поле (или напишите НЕТ)';
        document.getElementById('procedures').classList.add('error');
        isValid = false;
    } else {
        proceduresError.textContent = '';
        document.getElementById('procedures').classList.remove('error');
    }

    const signatureError = document.getElementById('signature-error');
    if (!hasSignature) {
        signatureError.textContent = 'Пожалуйста, нарисуйте вашу подпись';
        isValid = false;
    } else {
        signatureError.textContent = '';
    }

    return isValid;
}

// ===== Download helper =====
async function triggerBrowserDownload(downloadUrl, fallbackName = 'agreement.pdf') {
    // Try blob download first
    try {
        const res = await fetch(downloadUrl, { method: 'GET', credentials: 'omit' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fallbackName;
        document.body.appendChild(a);
        a.click();
        a.remove();

        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        return true;
    } catch (e) {
        console.warn('Blob download failed, fallback to direct open:', e);
    }

    // Fallback: direct open
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return false;
}

// ===== Submit / Webhook =====
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
            birthdate: document.getElementById('birthdate').value,
            gender: document.getElementById('gender').value,
            iin: document.getElementById('iin').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            allergy: document.getElementById('allergy').value.trim(),
            procedures: document.getElementById('procedures').value.trim()
        };

        const webhookResult = await sendToWebhook(formData);

        if (!webhookResult?.downloadUrl) {
            throw new Error('n8n не вернул downloadUrl');
        }

        submitBtn.textContent = 'Скачиваем документ...';

        // Auto-download immediately when link arrives
        await triggerBrowserDownload(
            webhookResult.downloadUrl,
            `${formData.iin || 'agreement'}.pdf`
        );

        // Keep button for manual re-download
        submitBtn.disabled = false;
        submitBtn.textContent = 'Скачать соглашение ещё раз';
        submitBtn.onclick = () => {
            triggerBrowserDownload(
                webhookResult.downloadUrl,
                `${formData.iin || 'agreement'}.pdf`
            );
        };
    } catch (error) {
        console.error('Error:', error);
        alert('Произошла ошибка: ' + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'ЗАВЕРШИТЬ';
    }
}

async function sendToWebhook(formData) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
            try {
                const multipartFormData = new FormData();
                multipartFormData.append('fio', formData.fio);
                multipartFormData.append('birthdate', formData.birthdate);
                multipartFormData.append('gender', formData.gender);
                multipartFormData.append('iin', formData.iin);
                multipartFormData.append('phone', formData.phone);
                multipartFormData.append('allergy', formData.allergy);
                multipartFormData.append('procedures', formData.procedures);
                multipartFormData.append('signature', blob, `${formData.iin}.png`);

                const response = await fetch(WEBHOOK_URL, {
                    method: 'POST',
                    body: multipartFormData
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`Ошибка сервера ${response.status}: ${errText}`);
                }

                const result = await response.json();
                resolve(result); // expected: { downloadUrl: "..." }
            } catch (error) {
                reject(new Error('Не удалось отправить данные: ' + error.message));
            }
        }, 'image/png');
    });
}
