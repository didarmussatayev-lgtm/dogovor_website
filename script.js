// API Configuration
const GOOGLE_CLIENT_ID = '387713201223-raigbff4jiftmkkjt3o2volh5nl20b3h.apps.googleusercontent.com';
const GOOGLE_API_KEY = 'AIzaSyBrUBlv-8jL3H4V7JCUmGGWW6xUQcBQxho';
const SCOPES = 'https://www.googleapis.com/auth/drive';
const WEBHOOK_URL = 'https://primary-production-7d413.up.railway.app/webhook/promed';
// Production webhook URL (uncomment to use):
// const WEBHOOK_URL = 'https://primary-production-7d413.up.railway.app/webhook/promed';

// Shared Google Drive folder ID
const SHARED_FOLDER_ID = '1DuWIUyPbdpW3uqg11xDTXsc-UHQ5aVX6';

// Google API state
let gapiInited = false;
let gisInited = false;
let tokenClient;
let accessToken = null;
let driveAuthenticated = false;

// Canvas variables
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
});

// Initialize Google API
function gapiLoaded() {
    if (typeof gapi === 'undefined') {
        console.error('gapi is not available. Make sure Google APIs script is loaded.');
        return;
    }
    console.log('Loading gapi client...');
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        gapiInited = true;
        console.log('✓ Google Drive API initialized');
        checkApisReady();
    } catch (error) {
        console.error('Error initializing GAPI:', error);
        showSignatureStatus('❌ Ошибка загрузки Google Drive API. Обновите страницу.', 'error');
    }
}

// Initialize Google Identity Services
let gisLoadAttempts = 0;
function gisLoaded() {
    gisLoadAttempts++;
    
    if (typeof google === 'undefined' || !google.accounts) {
        if (gisLoadAttempts > 50) { // 5 seconds
            console.error('Google Identity Services failed to load after 5 seconds');
            return;
        }
        setTimeout(gisLoaded, 100);
        return;
    }
    
    try {
        console.log('Initializing Google Identity Services...');
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: '', // Will be set during request
        });
        gisInited = true;
        console.log('✓ Google Identity Services initialized');
        checkApisReady();
    } catch (error) {
        console.error('Error initializing GIS:', error);
        showSignatureStatus('❌ Ошибка загрузки Google Auth. Обновите страницу.', 'error');
    }
}

// Check if both APIs are ready and enable the save button
function checkApisReady() {
    console.log('Checking APIs ready - gapi:', gapiInited, 'gis:', gisInited);
    if (gapiInited && gisInited) {
        const saveBtn = document.getElementById('saveSignature');
        saveBtn.disabled = false;
        hideSignatureStatus();
        console.log('✓ Все Google APIs готовы к использованию');
        console.log('Save button enabled:', !saveBtn.disabled);
    }
}

// Request access token
function requestAccessToken(callback) {
    tokenClient.callback = async (response) => {
        if (response.error !== undefined) {
            console.error('OAuth error:', response);
            throw response;
        }
        accessToken = response.access_token;
        driveAuthenticated = true;
        
        // Store token in localStorage with expiry time
        localStorage.setItem('google_access_token', accessToken);
        // Token expires in 1 hour (3600 seconds), store expiry time
        const expiryTime = Date.now() + (3600 * 1000);
        localStorage.setItem('google_token_expiry', expiryTime.toString());
        console.log('✓ Access token stored in localStorage');
        
        gapi.client.setToken({ access_token: accessToken });
        callback();
    };
    
    if (accessToken === null) {
        // Prompt the user to select a Google Account and consent
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        // Skip display of account chooser and consent dialog
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

// Initialize Canvas for signature
function initializeCanvas() {
    canvas = document.getElementById('signatureCanvas');
    ctx = canvas.getContext('2d');
    
    // Set canvas size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // Touch events for mobile
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', stopDrawing);
    
    // Clear button
    document.getElementById('clearSignature').addEventListener('click', clearSignature);
    
    // Save signature button
    document.getElementById('saveSignature').addEventListener('click', handleSaveSignature);
    
    // Download signature button
    document.getElementById('downloadSignature').addEventListener('click', downloadSignature);
    
    // Setup canvas drawing style
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // Redraw if needed (though this will clear the canvas)
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSignature = false;
    document.getElementById('signature-error').textContent = '';
    hideSignatureStatus();
}

// Download signature as PNG file
function downloadSignature() {
    if (!hasSignature) {
        showSignatureStatus('Пожалуйста, нарисуйте подпись перед загрузкой', 'error');
        return;
    }
    
    // Get IIN for filename
    const iin = document.getElementById('iin').value.trim();
    const filename = iin ? `signature_${iin}.png` : 'signature.png';
    
    // Convert canvas to blob and download
    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSignatureStatus('✓ Подпись сохранена как ' + filename, 'success');
    }, 'image/png');
}

// Handle signature save button click
function handleSaveSignature() {
    console.log('Save button clicked!');
    console.log('hasSignature:', hasSignature);
    
    const saveBtn = document.getElementById('saveSignature');
    
    // Validate signature exists
    if (!hasSignature) {
        console.error('No signature drawn');
        showSignatureStatus('Пожалуйста, нарисуйте подпись перед сохранением', 'error');
        return;
    }
    
    // Mark signature as saved and update button
    saveBtn.textContent = 'Сохранено';
    saveBtn.classList.add('btn-saved');
    saveBtn.disabled = true;
    showSignatureStatus('✓ Подпись готова к отправке', 'success');
}

function showSignatureStatus(message, type) {
    const statusDiv = document.getElementById('signature-status');
    statusDiv.textContent = message;
    statusDiv.className = 'signature-status ' + type;
}

function hideSignatureStatus() {
    const statusDiv = document.getElementById('signature-status');
    statusDiv.style.display = 'none';
    statusDiv.className = 'signature-status';
}

// Form validation
function initializeForm() {
    const form = document.getElementById('consentForm');
    
    // Real-time validation on input
    document.getElementById('phone').addEventListener('input', validatePhone);
    document.getElementById('iin').addEventListener('input', validateIIN);
    document.getElementById('birthdate').addEventListener('input', formatBirthdate);
    document.getElementById('fio').addEventListener('input', validateFIO);
    
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
    
    // Russian and Kazakh letters: А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі and spaces/hyphens
    const nameRegex = /^[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі\s\-]+$/;
    
    if (!nameRegex.test(fio)) {
        fioError.textContent = 'ФИО должно содержать только русские или казахские буквы';
        fioInput.classList.add('error');
        return false;
    } else {
        fioError.textContent = '';
        fioInput.classList.remove('error');
        return true;
    }
}

function validatePhone() {
    const phoneInput = document.getElementById('phone');
    const phoneError = document.getElementById('phone-error');
    const phone = phoneInput.value.trim();
    
    // Phone should start with +7 or 8, followed by 10 digits
    const phoneRegex = /^(\+7|8)\d{10}$/;
    
    if (phone === '') {
        phoneError.textContent = '';
        phoneInput.classList.remove('error');
        return false;
    }
    
    if (!phoneRegex.test(phone)) {
        phoneError.textContent = 'Телефон должен начинаться с +7 или 8 и содержать 10 цифр';
        phoneInput.classList.add('error');
        return false;
    } else {
        phoneError.textContent = '';
        phoneInput.classList.remove('error');
        return true;
    }
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
    
    // IIN should be exactly 12 digits
    if (!/^\d{12}$/.test(iin)) {
        iinError.textContent = 'ИИН должен содержать ровно 12 цифр';
        iinInput.classList.add('error');
        return false;
    } else {
        iinError.textContent = '';
        iinInput.classList.remove('error');
        return true;
    }
}

function formatBirthdate() {
    const input = document.getElementById('birthdate');
    let value = input.value.replace(/\D/g, ''); // Remove non-digits
    
    if (value.length >= 2) {
        value = value.slice(0, 2) + '/' + value.slice(2);
    }
    if (value.length >= 5) {
        value = value.slice(0, 5) + '/' + value.slice(5, 9);
    }
    
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
    
    // Check format dd/mm/yyyy
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = birthdate.match(dateRegex);
    
    if (!match) {
        birthdateError.textContent = 'Формат: дд/мм/гггг';
        birthdateInput.classList.add('error');
        return false;
    }
    
    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    const year = parseInt(match[3]);
    
    // Validate date ranges
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
    
    // Validate ФИО
    const fioInput = document.getElementById('fio');
    if (!validateFIO()) {
        if (fioInput.value.trim() === '') {
            document.getElementById('fio-error').textContent = 'Пожалуйста, введите ФИО';
            fioInput.classList.add('error');
        }
        isValid = false;
    }
    
    // Validate birthdate
    if (!validateBirthdate()) {
        const birthdateInput = document.getElementById('birthdate');
        if (birthdateInput.value.trim() === '') {
            document.getElementById('birthdate-error').textContent = 'Пожалуйста, введите дату рождения';
        }
        isValid = false;
    }
    
    // Validate gender
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
    
    // Validate IIN
    if (!validateIIN()) {
        const iinInput = document.getElementById('iin');
        if (iinInput.value.trim() === '') {
            document.getElementById('iin-error').textContent = 'Пожалуйста, введите ИИН';
        }
        isValid = false;
    }
    
    // Validate phone
    if (!validatePhone()) {
        const phoneInput = document.getElementById('phone');
        if (phoneInput.value.trim() === '') {
            document.getElementById('phone-error').textContent = 'Пожалуйста, введите телефон';
        }
        isValid = false;
    }
    
    // Validate allergy
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
    
    // Validate procedures
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
    
    // Validate signature
    const signatureError = document.getElementById('signature-error');
    if (!hasSignature) {
        signatureError.textContent = 'Пожалуйста, нарисуйте вашу подпись';
        isValid = false;
    } else {
        signatureError.textContent = '';
    }
    
    return isValid;
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

    // Validate all fields
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
        // Get form data
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

// Upload signature to side server (Railway)
async function uploadSignatureToServer(iin) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
            try {
                const formData = new FormData();
                formData.append('image', blob, `${iin}.png`);
                formData.append('iin', iin);
                
                console.log('Sending signature to server...');
                console.log('IIN:', iin);
                console.log('Blob size:', blob.size, 'bytes');
                
                const response = await fetch('https://web-production-e4b46.up.railway.app/upload-signature', {
                    method: 'POST',
                    mode: 'cors',
                    body: formData
                });
                
                console.log('Response status:', response.status);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Server error response:', errorText);
                    throw new Error(`Server error: ${response.status} - ${errorText}`);
                }
                
                const result = await response.json();
                console.log('Signature uploaded successfully:', result);
                if (result.file && result.file.viewLink) {
                    console.log('View link:', result.file.viewLink);
                }
                resolve(result);
                
            } catch (error) {
                console.error('Error uploading signature to server:', error);
                console.error('Error details:', error.message, error.stack);
                
                // Provide more specific error message
                if (error.message === 'Failed to fetch') {
                    reject(new Error('Не удалось подключиться к серверу. Проверьте подключение к интернету.'));
                } else {
                    reject(error);
                }
            }
        }, 'image/png');
    });
}

// Upload signature to Google Drive using client-side API
async function uploadSignatureToDrive(iin) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
            try {
                // Check if APIs are initialized
                if (!gapiInited || !gisInited) {
                    throw new Error('Google APIs не загружены. Пожалуйста, обновите страницу.');
                }
                
                // Function to perform upload
                const performUpload = async () => {
                    try {
                        // Set token if we have one stored
                        if (accessToken && driveAuthenticated) {
                            gapi.client.setToken({ access_token: accessToken });
                        }
                        
                        // Step 1: Create IIN subfolder in shared folder
                        console.log('Step 1: Creating IIN subfolder in shared folder...');
                        const iinFolderId = await findOrCreateSubfolder(iin, SHARED_FOLDER_ID);
                        console.log('Subfolder created/found:', iinFolderId);
                        
                        // Step 2: Find and copy "общее.docx" file
                        console.log('Step 2: Copying общее.docx...');
                        try {
                            await copyDocxToFolder(iinFolderId);
                            console.log('Document copied successfully');
                        } catch (docError) {
                            console.error('Failed to copy document:', docError);
                            // Continue with signature upload even if docx copy fails
                        }
                        
                        // Step 3: Upload signature as {iin}.png
                        console.log('Step 3: Uploading signature...');
                        const reader = new FileReader();
                        reader.onloadend = async function() {
                            try {
                                // Create file metadata
                                const fileMetadata = {
                                    name: `${iin}.png`,
                                    parents: [iinFolderId],
                                    mimeType: 'image/png'
                                };
                                
                                // Upload file using multipart upload
                                const form = new FormData();
                                form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
                                form.append('file', blob);
                                
                                const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                                    method: 'POST',
                                    headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
                                    body: form
                                });
                                
                                const result = await response.json();
                                
                                if (!response.ok) {
                                    // If token expired, clear stored token and retry
                                    if (response.status === 401) {
                                        localStorage.removeItem('google_access_token');
                                        localStorage.removeItem('google_token_expiry');
                                        accessToken = null;
                                        driveAuthenticated = false;
                                        throw new Error('Токен истек. Пожалуйста, попробуйте снова.');
                                    }
                                    throw new Error(result.error?.message || 'Ошибка при загрузке файла');
                                }
                                
                                console.log('Signature uploaded successfully:', result);
                                resolve(result);
                            } catch (error) {
                                console.error('Error uploading signature:', error);
                                reject(error);
                            }
                        };
                        reader.readAsDataURL(blob);
                        
                    } catch (error) {
                        console.error('Error in performUpload:', error);
                        // If token error, clear localStorage
                        if (error.message && error.message.includes('Токен')) {
                            localStorage.removeItem('google_access_token');
                            localStorage.removeItem('google_token_expiry');
                            accessToken = null;
                            driveAuthenticated = false;
                        }
                        reject(error);
                    }
                };
                
                // Request access token if not authenticated
                if (!driveAuthenticated || !accessToken) {
                    requestAccessToken(performUpload);
                } else {
                    await performUpload();
                }
                
            } catch (error) {
                reject(error);
            }
        }, 'image/png');
    });
}

// Copy general.docx file to target folder
async function copyDocxToFolder(targetFolderId) {
    try {
        // Search for general.docx file in user's Drive (broader search)
        console.log('Searching for "general.docx"...');
        const searchResponse = await gapi.client.drive.files.list({
            q: "(name='general.docx' or name contains 'general') and trashed=false",
            fields: 'files(id, name, mimeType, parents)',
            spaces: 'drive',
            pageSize: 100
        });
        
        console.log('Search results:', searchResponse.result.files);
        
        if (!searchResponse.result.files || searchResponse.result.files.length === 0) {
            // List ALL files to help debug
            console.log('No files found. Listing all recent files...');
            const allFiles = await gapi.client.drive.files.list({
                q: "trashed=false",
                fields: 'files(id, name, mimeType)',
                spaces: 'drive',
                pageSize: 20,
                orderBy: 'modifiedTime desc'
            });
            console.log('Recent files in Drive:', allFiles.result.files);
            
            throw new Error('Файл "general.docx" не найден. Проверьте консоль для списка доступных файлов.');
        }
        
        // Find exact match or first result
        let sourceFile = searchResponse.result.files.find(f => f.name === 'general.docx');
        if (!sourceFile) {
            sourceFile = searchResponse.result.files[0];
            console.warn(`Exact match not found, using: ${sourceFile.name}`);
        }
        
        const sourceFileId = sourceFile.id;
        console.log('Using file:', sourceFile.name, 'ID:', sourceFileId);
        console.log('Target folder ID:', targetFolderId);
        
        // Copy the file to target folder
        const copyResponse = await gapi.client.drive.files.copy({
            fileId: sourceFileId,
            resource: {
                parents: [targetFolderId],
                name: 'общее.docx'
            },
            fields: 'id, name, mimeType'
        });
        
        console.log('Document copied successfully:', copyResponse.result);
        return copyResponse.result;
        
    } catch (error) {
        console.error('Error copying document:', error);
        if (error.result && error.result.error) {
            console.error('API Error:', error.result.error);
        }
        throw new Error('Не удалось скопировать файл: ' + (error.message || 'Неизвестная ошибка'));
    }
}

// Find or create subfolder in shared Google Drive folder
async function findOrCreateSubfolder(subfolderName, parentFolderId) {
    try {
        // Search for existing subfolder in the parent folder
        const response = await gapi.client.drive.files.list({
            q: `name='${subfolderName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });
        
        if (response.result.files && response.result.files.length > 0) {
            console.log('Subfolder already exists:', response.result.files[0].id);
            return response.result.files[0].id;
        }
        
        // Create subfolder if it doesn't exist
        const folderMetadata = {
            name: subfolderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId]
        };
        
        const folder = await gapi.client.drive.files.create({
            resource: folderMetadata,
            fields: 'id'
        });
        
        console.log('Subfolder created:', folder.result.id);
        return folder.result.id;
        
    } catch (error) {
        console.error('Error finding/creating subfolder:', error);
        // If 401, token expired
        if (error.status === 401) {
            localStorage.removeItem('google_access_token');
            localStorage.removeItem('google_token_expiry');
            accessToken = null;
            driveAuthenticated = false;
            throw new Error('Токен истек. Пожалуйста, попробуйте снова.');
        }
        throw new Error('Не удалось создать папку в Google Drive');
    }
}

// Send data to n8n webhook with signature as PNG file
async function sendToWebhook(formData) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
            try {
                const multipartFormData = new FormData();
                
                // Add all form fields
                multipartFormData.append('fio', formData.fio);
                multipartFormData.append('birthdate', formData.birthdate);
                multipartFormData.append('gender', formData.gender);
                multipartFormData.append('iin', formData.iin);
                multipartFormData.append('phone', formData.phone);
                multipartFormData.append('allergy', formData.allergy);
                multipartFormData.append('procedures', formData.procedures);
                
                // Add signature as PNG file
                multipartFormData.append('signature', blob, `${formData.iin}.png`);
                
                const response = await fetch(WEBHOOK_URL, {
                    method: 'POST',
                    body: multipartFormData
                });
                
                if (!response.ok) {
                    throw new Error('Ошибка при отправке данных на сервер');
                }
                
                const result = await response.json();
                resolve(result);
            } catch (error) {
                reject(new Error('Не удалось отправить данные: ' + error.message));
            }
        }, 'image/png');
    });
}
