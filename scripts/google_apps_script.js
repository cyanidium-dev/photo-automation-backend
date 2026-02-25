/**
 * Google Apps Script — installable trigger через панель тригерів
 *
 * ВСТАНОВЛЕННЯ:
 * 1. Вставте цей скрипт в Apps Script
 * 2. Встановіть BACKEND_URL
 * 3. Збережіть скрипт
 * 4. Відкрийте панель тригерів: Triggers (⏰) → Add Trigger
 *    - Choose function: onSheetEdit
 *    - Event source: From spreadsheet
 *    - Event type: On edit
 * 5. Збережіть тригер і авторизуйтесь
 */

// ⚠️ ЗАМІНИТИ на реальну URL вашого бекенду
const BACKEND_URL = 'https://your-backend-url.com';

// Колонки (1-indexed)
const COL = {
    RETOUCHED: 5,     // E — Відретушовані фото
    GALLERY_LINK: 18, // R — Посилання
    CLIENT_NAME: 19,  // S — ПІ клієнта
    EMAIL: 21,        // U — Ел пошта
};

function onSheetEdit(e) {
    const range = e.range;
    const sheet = range.getSheet();
    const col = range.getColumn();
    const row = range.getRow();
    const value = range.getValue();

    // 🔍 DEBUG — видно в Execution log (Apps Script → Executions)
    console.log('onSheetEdit fired: col=' + col + ' row=' + row + ' value=' + value);

    // Пропустити рядок заголовка
    if (row <= 1) {
        console.log('Skipping header row.');
        return;
    }

    // Колонка R — "Посилання" (Gallery Link)
    if (col === COL.GALLERY_LINK) {
        const galleryLink = range.getValue();

        if (galleryLink && galleryLink.toString().startsWith('http')) {
            const clientName = sheet.getRange(row, COL.CLIENT_NAME).getValue();
            const email = sheet.getRange(row, COL.EMAIL).getValue();

            if (!email) {
                console.warn('Рядок ' + row + ': email відсутній, пропускаємо.');
                return;
            }

            sendWebhook({
                clientName: clientName,
                email: email,
                galleryLink: galleryLink,
                eventType: 'gallery_link',
            });
        }
    }

    // Колонка E — "Відретушовані фото"
    if (col === COL.RETOUCHED && range.getValue() === true) {
        const clientName = sheet.getRange(row, COL.CLIENT_NAME).getValue();
        const email = sheet.getRange(row, COL.EMAIL).getValue();

        if (!email) {
            console.warn('Рядок ' + row + ': email відсутній, пропускаємо.');
            return;
        }

        sendWebhook({
            clientName: clientName,
            email: email,
            retouched: true,
            eventType: 'retouched',
        });
    }
}

function sendWebhook(payload) {
    const url = BACKEND_URL + '/webhooks/sheets/update';
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
            console.log('[OK] Webhook надіслано (' + payload.eventType + ') для: ' + payload.email);
        } else {
            console.error('[ERROR] Бекенд повернув ' + code + ': ' + response.getContentText());
        }
    } catch (err) {
        console.error('[ERROR] Не вдалося надіслати webhook: ' + err.toString());
    }
}
