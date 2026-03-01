/** ─── КОНФІГУРАЦІЯ ──────────────────────────────────────────────────────────── */
const props = PropertiesService.getScriptProperties().getProperties();

const CONFIG = {
    BACKEND_URL: props.BACKEND_URL || '',
    API_KEY: props.API_SECRET_KEY || '',
    DEBOUNCE_MS: 5000,
    CACHE_TTL: 25,
    COL: {
        ID: 1,            // A
        DATE: 3,          // C
        TIME: 4,          // D
        RETOUCHED: 5,     // E
        GALLERY_LINK: 18, // R
        CLIENT_NAME: 19,  // S
        EMAIL: 21,        // U
        STATUS: 23,       // W
    }
};

/**
 * Головний обробник подій редагування
 */
function onSheetEdit(e) {
    console.log("--- ТРИГЕР onSheetEdit ЗАПУЩЕНО ---");
    if (!e || !e.range) return;

    const range = e.range;
    const sheet = range.getSheet();
    const col = range.getColumn();
    const row = range.getRow();
    const value = range.getValue();

    if (row <= 1) return;

    // Читаємо рядок один раз
    const lastCol = Math.max(col, CONFIG.COL.EMAIL, CONFIG.COL.GALLERY_LINK);
    const rowData = sheet.getRange(row, 1, 1, lastCol).getValues()[0];

    const clientEmail = rowData[CONFIG.COL.EMAIL - 1];
    const clientName = rowData[CONFIG.COL.CLIENT_NAME - 1];
    const bookingId = rowData[CONFIG.COL.ID - 1];
    const bookingDate = rowData[CONFIG.COL.DATE - 1];


    // ── ЛОГІКА: Посилання на галерею ──────────────────────────────
    if (col === CONFIG.COL.GALLERY_LINK) {
        let galleryLink = value ? value.toString().trim() : '';

        if (galleryLink !== '') {
            // Якщо користувач забув http/https — додаємо автоматично для валідності
            if (!galleryLink.toLowerCase().startsWith('http')) {
                galleryLink = 'https://' + galleryLink;
            }

            if (!isValidEmail(clientEmail)) {
                console.warn(`Рядок ${row}: Email невалідний, пропускаємо.`);
                return;
            }

            const cache = CacheService.getScriptCache();
            const lockKey = `gallery_lock_${row}`;
            const editTs = Date.now().toString();

            cache.put(lockKey, editTs, CONFIG.CACHE_TTL);
            console.log(`[WAIT] Дебаунс 5с для рядка ${row}...`);
            Utilities.sleep(CONFIG.DEBOUNCE_MS);

            if (cache.get(lockKey) === editTs) {
                sendWebhook({
                    id: bookingId,
                    date: bookingDate,
                    clientName,
                    email: clientEmail,
                    galleryLink: galleryLink,
                    eventType: 'gallery_link'
                });
                sheet.getRange(row, CONFIG.COL.STATUS).setValue("лист відправлено");
            }
        }
    }

    // ── ЛОГІКА: Відретушовані фото ──
    if (col === CONFIG.COL.RETOUCHED && (value === true || value === 'TRUE')) {
        if (isValidEmail(clientEmail)) {
            sendWebhook({
                id: bookingId,
                date: bookingDate,
                clientName,
                email: clientEmail,
                retouched: true,
                eventType: 'retouched'
            });
            sheet.getRange(row, CONFIG.COL.STATUS).setValue("лист відправлено");
        }
    }

    // ── ЛОГІКА: Сортування ──
    if (col === CONFIG.COL.DATE || col === CONFIG.COL.TIME) {
        if (rowData[CONFIG.COL.DATE - 1] && rowData[CONFIG.COL.TIME - 1]) {
            const cache = CacheService.getScriptCache();
            const lockKey = `sort_lock_${sheet.getName()}`;
            const editTs = Date.now().toString();

            cache.put(lockKey, editTs, CONFIG.CACHE_TTL);
            Utilities.sleep(CONFIG.DEBOUNCE_MS);

            if (cache.get(lockKey) === editTs) {
                autoSortSheet(sheet);
            }
        }
    }
    if (col === CONFIG.COL.DATE || col === CONFIG.COL.TIME || col === CONFIG.COL.RETOUCHED) {
        fixCheckbox(sheet, row);
    }
}

/**
 * HTTP: ЗАПИТ ВІД БЕКЕНДУ (doPost)
 */
function doPost(e) {
    try {
        const postData = JSON.parse(e.postData.contents);

        // БЕЗПЕКА: Перевірка ключа
        const incomingKey = postData['X-API-KEY'] || e.parameter['api_key'];
        if (incomingKey !== CONFIG.API_KEY) {
            return jsonResponse({ status: 'error', message: 'Unauthorized' });
        }

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = postData.sheetName ? ss.getSheetByName(postData.sheetName) : ss.getActiveSheet();
        if (!sheet) return jsonResponse({ status: 'error', message: 'Sheet not found' });

        // 1. Спочатку виконуємо сортування
        autoSortSheet(sheet);

        // 2. ЛОГІКА ВИПРАВЛЕННЯ ЧЕКБОКСА ЗА ID
        const idToFind = postData.id; // Бекенд має передавати "id" у JSON

        if (idToFind) {
            const lastRow = sheet.getLastRow();
            // Отримуємо всі ID з першої колонки (Колонка A = 1)
            // Якщо ID в іншій колонці, замініть "1" на потрібний номер
            const ids = sheet.getRange(1, 1, lastRow).getValues();

            let targetRow = -1;
            // Шукаємо рядок з потрібним ID
            for (let i = lastRow - 1; i >= 0; i--) {
                if (ids[i][0].toString() === idToFind.toString()) {
                    targetRow = i + 1;
                    break;
                }
            }

            // 3. Якщо рядок знайдено — примусово ставимо чекбокс
            if (targetRow !== -1 && postData.hasOwnProperty('retouched') && postData.retouched !== undefined) {
                const cell = sheet.getRange(targetRow, CONFIG.COL.RETOUCHED);

                // РАДИКАЛЬНИЙ ФІКС: очищуємо текст і ставимо графічний елемент
                cell.clearContent();
                cell.clearDataValidations();
                cell.setNumberFormat('General');
                cell.insertCheckboxes();

                // Встановлюємо стан (за замовчуванням false, або що прийшло з бекенду)
                const isRetouched = postData.retouched === true || postData.retouched === 'true';
                cell.setValue(isRetouched);

                console.log(`ID ${idToFind} знайдено в рядку ${targetRow}. Чекбокс оновлено станом: ${isRetouched}`);
            } else if (targetRow !== -1) {
                console.log(`ID ${idToFind} знайдено в рядку ${targetRow}. Чекбокс не оновлювався (немає даних про ретуш).`);
            } else {
                console.warn(`Запис з ID ${idToFind} не знайдено після сортування.`);
            }
        }

        return jsonResponse({ status: 'success', sheet: sheet.getName() });
    } catch (err) {
        console.error("Помилка doPost: " + err.toString());
        return jsonResponse({ status: 'error', message: err.toString() });
    }
}
/**
 * СОРТУВАННЯ (З LockService)
 */
function autoSortSheet(sheet) {
    const lock = LockService.getScriptLock();
    try {
        if (!lock.tryLock(10000)) return; // Чекаємо 10 сек

        const lastRow = sheet.getLastRow();
        if (lastRow <= 1) return;

        // Нормалізація дат
        const dateRange = sheet.getRange(2, CONFIG.COL.DATE, lastRow - 1, 1);
        const dateValues = dateRange.getValues().map(([val]) => {
            if (typeof val === 'string' && val.includes('.')) {
                const p = val.split('.');
                const d = new Date(p[2], p[1] - 1, p[0]);
                return isNaN(d.getTime()) ? [val] : [d];
            }
            return [val];
        });

        dateRange.setValues(dateValues);
        sheet.getRange(2, CONFIG.COL.DATE, lastRow - 1, 1).setNumberFormat('dd.mm.yyyy');
        sheet.getRange(2, CONFIG.COL.TIME, lastRow - 1, 1).setNumberFormat('HH:mm:ss');

        const dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
        dataRange.sort([
            { column: CONFIG.COL.DATE, ascending: true },
            { column: CONFIG.COL.TIME, ascending: true },
        ]);
    } catch (e) {
        console.error("Sort error: " + e.message);
    } finally {
        lock.releaseLock();
    }
}

/**
 * НАДСИЛАННЯ ВЕБХУКА (Тут Headers ПРАЦЮЮТЬ)
 */
function sendWebhook(payload) {
    console.log("--- ТРИГЕР ЗАПУЩЕНО ---");
    const options = {
        method: 'post',
        contentType: 'application/json',
        headers: {
            'X-API-KEY': CONFIG.API_KEY,
            'ngrok-skip-browser-warning': 'true'
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    };
    const baseUrl = CONFIG.BACKEND_URL.trim().replace(/\/$/, "");
    const fullUrl = baseUrl + "/webhooks/sheets/update";
    console.log('Sending webhook to:', fullUrl);
    try {
        const response = UrlFetchApp.fetch(fullUrl, options);
        console.log(`[${payload.eventType}] Status: ${response.getResponseCode()}`);
    } catch (err) {
        console.error(`Webhook error: ${err}`);
    }
}

function isValidEmail(email) {
    if (!email) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.toString().trim());
}

function jsonResponse(data) {
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Оптимізоване форматування одного конкретного чекбокса
 */
function fixCheckbox(sheet, row) {
    if (row <= 1) return;
    const cell = sheet.getRange(row, CONFIG.COL.RETOUCHED);
    const val = cell.getValue();

    // Перетворюємо будь-яке значення (текст "false", рядок "TRUE", null) у справжній Boolean
    let boolVal = false;
    if (typeof val === 'string') {
        boolVal = (val.toLowerCase().trim() === 'true');
    } else {
        boolVal = Boolean(val);
    }

    // Швидке "лікування" клітинки
    cell.clearDataValidations();
    cell.insertCheckboxes();
    cell.setValue(boolVal);
}