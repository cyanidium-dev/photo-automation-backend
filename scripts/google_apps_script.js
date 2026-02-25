// ─── КОНФІГУРАЦІЯ ────────────────────────────────────────────────────────────

const BACKEND_URL = 'https://7bbc-109-87-95-102.ngrok-free.app';

// Карта колонок (1-indexed)
const COL = {
    DATE: 3,          // C — Дата фотосесії
    TIME: 4,          // D — Година фотосесії
    RETOUCHED: 5,     // E — Відретушовані фото
    GALLERY_LINK: 18, // R — Посилання
    CLIENT_NAME: 19,  // S — ПІ клієнта
    EMAIL: 21,        // U — Ел пошта
};

// ─── ТРИГЕРИ РЕДАГУВАННЯ ─────────────────────────────────────────────────────

/**
 * Installable trigger — встановлюйте вручну через панель тригерів:
 * Triggers (⏰) → Add Trigger → onSheetEdit → From spreadsheet → On edit
 *
 * Обробляє:
 *   - Вставку посилання на галерею (кол. R) → надсилає webhook gallery_link
 *   - Позначку "Відретушовані фото" (кол. E) → надсилає webhook retouched
 *   - Зміну дати або часу (кол. C, D) → сортує аркуш із debounce 5 с
 */
function onSheetEdit(e) {
    const range = e.range;
    const sheet = range.getSheet();
    const col = range.getColumn();
    const row = range.getRow();
    const value = range.getValue();

    console.log(`onSheetEdit: col=${col} row=${row} value=${value}`);

    if (row <= 1) return; // пропускаємо заголовок

    // ── Посилання на галерею ──────────────────────────────────────────────────
    if (col === COL.GALLERY_LINK) {
        const galleryLink = value ? value.toString() : '';

        if (galleryLink.startsWith('http')) {
            const clientName = sheet.getRange(row, COL.CLIENT_NAME).getValue();
            const email = sheet.getRange(row, COL.EMAIL).getValue();

            if (!email) {
                console.warn(`Рядок ${row}: email відсутній, пропускаємо.`);
                return;
            }

            sendWebhook({ clientName, email, galleryLink, eventType: 'gallery_link' });
        }
    }

    // ── Відретушовані фото ────────────────────────────────────────────────────
    if (col === COL.RETOUCHED && value === true) {
        const clientName = sheet.getRange(row, COL.CLIENT_NAME).getValue();
        const email = sheet.getRange(row, COL.EMAIL).getValue();

        if (!email) {
            console.warn(`Рядок ${row}: email відсутній, пропускаємо.`);
            return;
        }

        sendWebhook({ clientName, email, retouched: true, eventType: 'retouched' });
    }

    // ── Дата або час змінились → сортування з debounce ───────────────────────
    if (col === COL.DATE || col === COL.TIME) {
        const dateValue = sheet.getRange(row, COL.DATE).getValue();
        const timeValue = sheet.getRange(row, COL.TIME).getValue();

        // Не сортуємо, поки обидва поля не заповнені
        if (!dateValue || !timeValue) return;

        const cache = CacheService.getScriptCache();
        const lockKey = `sort_lock_${sheet.getName()}`;
        const editTs = Date.now().toString();

        // Зберігаємо мітку часу поточного редагування
        cache.put(lockKey, editTs, 15); // TTL 15 с
        Utilities.sleep(5000);          // чекаємо 5 с debounce

        // Сортуємо лише якщо за цей час не було нових змін
        if (cache.get(lockKey) === editTs) {
            autoSortSheet(sheet);
            cache.remove(lockKey);
        }
    }
}

// ─── HTTP: ЗАПИТ ВІД БЕКЕНДУ (doPost) ────────────────────────────────────────

/**
 * Викликається NestJS через triggerAutoSort → POST /exec
 * Тіло запиту: { sheetName: string }
 */
function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        const sheetName = data.sheetName;

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getActiveSheet();

        if (!sheet) {
            return jsonResponse({ status: 'error', message: `Аркуш "${sheetName}" не знайдено` });
        }

        autoSortSheet(sheet);

        return jsonResponse({ status: 'success', sheet: sheet.getName() });
    } catch (err) {
        return jsonResponse({ status: 'error', message: err.toString() });
    }
}

// ─── HTTP: WEBHOOK ДО БЕКЕНДУ ─────────────────────────────────────────────────

function sendWebhook(payload) {
    const url = `${BACKEND_URL}/webhooks/sheets/update`;
    const options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
    };

    try {
        const response = UrlFetchApp.fetch(url, options);
        const code = response.getResponseCode();

        if (code >= 200 && code < 300) {
            console.log(`[OK] Webhook (${payload.eventType}) для: ${payload.email}`);
        } else {
            console.error(`[ERROR] Бекенд повернув ${code}: ${response.getContentText()}`);
        }
    } catch (err) {
        console.error(`[ERROR] Не вдалося надіслати webhook: ${err}`);
    }
}

// ─── СОРТУВАННЯ ───────────────────────────────────────────────────────────────

/**
 * Сортує аркуш за Датою (кол. C) та Часом (кол. D).
 * Нормалізує дати у форматі "dd.mm.yyyy" → Date перед сортуванням.
 */
function autoSortSheet(sheet) {
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    const lastCol = sheet.getLastColumn();
    const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);

    // ── Нормалізація текстових дат "dd.mm.yyyy" → Date (лише колонка DATE) ──
    const dateRange = sheet.getRange(2, COL.DATE, lastRow - 1, 1);
    const dateValues = dateRange.getValues(); // [[val], [val], ...]

    const normalizedDates = dateValues.map(([dateVal]) => {
        if (typeof dateVal === 'string' && dateVal.includes('.')) {
            const parts = dateVal.split('.');
            if (parts.length === 3) {
                const parsed = new Date(
                    Number(parts[2]),
                    Number(parts[1]) - 1,
                    Number(parts[0]),
                );
                // Перевіряємо, що дата валідна
                if (!isNaN(parsed.getTime())) {
                    return [parsed];
                }
            }
        }
        return [dateVal];
    });

    // Записуємо лише нормалізовану колонку дати — мінімум операцій запису
    dateRange.setValues(normalizedDates);

    // Форматування колонок дати та часу
    sheet.getRange(2, COL.DATE, lastRow - 1, 1).setNumberFormat('dd.mm.yyyy');
    sheet.getRange(2, COL.TIME, lastRow - 1, 1).setNumberFormat('HH:mm:ss');

    // Сортування: спочатку за датою, потім за часом
    dataRange.sort([
        { column: COL.DATE, ascending: true },
        { column: COL.TIME, ascending: true },
    ]);

    console.log(`✅ Аркуш "${sheet.getName()}" відсортовано (${lastRow - 1} рядків)`);
}

// ─── ХЕЛПЕРИ ─────────────────────────────────────────────────────────────────

function jsonResponse(data) {
    return ContentService
        .createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}