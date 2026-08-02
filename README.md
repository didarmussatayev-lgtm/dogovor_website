# Система электронных согласий — MVP

Клиент сканирует QR-код → открывает форму на GitHub Pages → подписывает согласие → получает скачанный PDF.
Бэкенд генерирует DOCX/PDF и загружает файлы в Google Drive.

---

## Архитектура

```
frontend/            # GitHub Pages (статика)
  index.html
  style.css
  script.js
  config.js          # конфигурация URL бэкенда

backend/             # FastAPI (Docker)
  app/
    main.py          # FastAPI app + CORS
    config.py        # Pydantic settings (.env)
    models.py        # Pydantic request models
    docgen.py        # DOCX → PDF (LibreOffice)
    drive.py         # Google Drive upload
    templates/
      soglasie_template.docx
  Dockerfile
  requirements.txt
  .env.example
  create_template.py # helper: генерирует DOCX-шаблон
```

---

## Быстрый старт (локально)

### 1. Подготовить DOCX-шаблон

Если шаблон ещё не создан:

```bash
cd backend
pip install python-docx
python create_template.py
```

### 2. Настроить переменные окружения

```bash
cp backend/.env.example backend/.env
# Отредактируйте backend/.env — укажите Drive folder ID и service account
```

### 3. Запустить бэкенд

**С Docker (рекомендуется):**

```bash
cd backend
docker build -t consent-backend .
docker run --env-file .env -p 8000:8000 consent-backend
```

**Без Docker (нужен LibreOffice):**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 4. Запустить фронтенд локально

Откройте `frontend/index.html` через VS Code Live Server или:

```bash
cd frontend
python -m http.server 5500
# → http://localhost:5500
```

Убедитесь, что в `frontend/config.js` указан верный `BACKEND_URL`:

```js
const BACKEND_URL = 'http://localhost:8000';
```

---

## Настройка Google Drive

1. В [Google Cloud Console](https://console.cloud.google.com/) создайте проект.
2. Включите **Google Drive API**.
3. Создайте **Service Account** → скачайте JSON-ключ.
4. На Google Drive создайте папку «Согласия» и поделитесь ею с email сервис-аккаунта (права Editor).
5. Скопируйте ID папки из URL: `https://drive.google.com/drive/folders/<FOLDER_ID>`
6. Заполните в `backend/.env`:

```env
GOOGLE_DRIVE_FOLDER_ID=<FOLDER_ID>
# Вариант A — JSON строкой:
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
# Вариант B — путь к файлу:
GOOGLE_SERVICE_ACCOUNT_FILE=service_account.json
```

> **Важно:** не коммитьте `service_account.json` и `.env` в репозиторий — они в `.gitignore`.

---

## Деплой бэкенда на Railway

1. Подключите репозиторий к Railway.
2. Укажите Root Directory: `backend`.
3. Railway автоматически найдёт `Dockerfile` и соберёт образ.
4. Добавьте переменные окружения в настройках Railway (те же, что в `.env`).
5. После деплоя скопируйте HTTPS-URL вида `https://your-app.up.railway.app`.

---

## Настройка GitHub Pages (фронтенд)

1. В `frontend/config.js` замените URL:

```js
const BACKEND_URL = 'https://your-app.up.railway.app';
```

2. В настройках репозитория: **Settings → Pages → Source**: выберите ветку `main` и папку `/frontend`.
3. GitHub Pages будет доступен по адресу `https://<username>.github.io/<repo>/`.
4. Добавьте этот URL в `CORS_ORIGINS` на бэкенде.

---

## Проверка end-to-end

1. Откройте форму на GitHub Pages (или `http://localhost:5500`).
2. Заполните ФИО, телефон (+7 (7XX) XXX-XX-XX), ИИН (12 цифр), аллергию.
3. Нарисуйте подпись.
4. Отметьте чекбокс согласия — кнопка «Завершить» станет активной.
5. Нажмите «Завершить» — появится индикатор загрузки.
6. Браузер автоматически скачает `soglasie_<id>_<ФИО>.pdf`.
7. В папке Google Drive появятся файлы `.docx` и `.pdf`.

Проверить здоровье API:

```bash
curl https://your-app.up.railway.app/health
# {"status":"ok"}
```

---

## Ограничения MVP

- Нет базы данных — история только в Google Drive.
- Нет аутентификации пользователей / личного кабинета.
- Нет оплаты.
- LibreOffice в Docker увеличивает образ (~400 MB) и может замедлять холодный старт.
- При большом количестве одновременных запросов возможна блокировка LibreOffice — для масштабирования нужна очередь задач.

---

## Переменные окружения (backend/.env)

| Переменная | Описание | Пример |
|---|---|---|
| `APP_ENV` | Окружение | `production` |
| `LOG_LEVEL` | Уровень логирования | `INFO` |
| `CORS_ORIGINS` | Разрешённые origins (через запятую) | `https://user.github.io` |
| `GOOGLE_DRIVE_FOLDER_ID` | ID папки на Drive | `1BxiM...` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON сервис-аккаунта строкой | `{"type":"service_account",...}` |
| `GOOGLE_SERVICE_ACCOUNT_FILE` | Путь к JSON файлу сервис-аккаунта | `service_account.json` |
| `TEMPLATE_PATH` | Путь к DOCX-шаблону | `app/templates/soglasie_template.docx` |

