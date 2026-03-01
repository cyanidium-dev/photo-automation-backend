import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleSpreadsheet,
  GoogleSpreadsheetWorksheet,
  GoogleSpreadsheetRow,
} from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { GOOGLE_SHEET_COLUMNS } from '../common/constants.js';
import { BookingData } from '../common/interfaces.js';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface IConfig {
  get(key: string): unknown;
}

@Injectable()
export class GoogleSheetsService implements OnModuleInit {
  private doc!: GoogleSpreadsheet;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {}

  async onModuleInit() {
    const config = this.configService as unknown as IConfig;
    const serviceAccountEmail = config.get(
      'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    ) as string;

    const spreadsheetId = config.get('GOOGLE_SHEETS_ID') as string;

    const rawKey = config.get('GOOGLE_SERVICE_ACCOUNT_KEY') as string;

    if (!serviceAccountEmail || !rawKey || !spreadsheetId) {
      console.error('Google Sheets configuration is missing');
      return;
    }

    // Newlines in env vars can be tricky. We handle escaped \n and also remove potential wrapped quotes.
    const serviceAccountKey = rawKey
      .replace(/\\n/g, '\n')
      .trim()
      .replace(/^"(.*)"$/, '$1')
      .replace(/^'(.*)'$/, '$1');

    const auth = new JWT({
      email: serviceAccountEmail,
      key: serviceAccountKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.doc = new GoogleSpreadsheet(spreadsheetId, auth);
    await this.doc.loadInfo();
  }

  async ensureMonthlySheet(date: string): Promise<GoogleSpreadsheetWorksheet> {
    const bookingDate = new Date(date);
    const monthYear = bookingDate.toLocaleString('uk-UA', {
      month: 'long',
      year: 'numeric',
    });

    let sheet = this.doc.sheetsByTitle[monthYear];
    if (!sheet) {
      sheet = await this.doc.addSheet({
        title: monthYear,
        headerValues: GOOGLE_SHEET_COLUMNS,
      });
    } else {
      // Check if headers match, if not, we might need to update them
      // This is a bit complex with google-spreadsheet, but we can at least try to ensure ID is there
      try {
        await sheet.loadHeaderRow();
        if (sheet.headerValues[0] !== 'ID') {
          await sheet.setHeaderRow(GOOGLE_SHEET_COLUMNS);
        }
      } catch (e) {
        console.warn('Could not update headers for existing sheet:', e);
      }
    }
    return sheet;
  }

  async upsertBooking(booking: BookingData) {
    const sheet = await this.ensureMonthlySheet(booking.date);
    const rows = await sheet.getRows();

    const existingRow = rows.find(
      (r: GoogleSpreadsheetRow) => String(r.get('ID')) === String(booking.id),
    );

    const rowData = this.mapToRow(booking);

    if (existingRow) {
      // Merge values: only update if the new value is not empty
      for (const [key, value] of Object.entries(rowData)) {
        const newValue =
          value !== undefined && value !== null ? String(value) : '';
        const isNewValueEmpty = newValue.trim() === '';

        // Protection for 'Відретушовані фото': ONLY update if SimplyBook says TRUE.
        // This prevents SimplyBook from clearing manual checkmarks in the sheet.
        if (key === 'Відретушовані фото') {
          if (value === true || value === 'TRUE') {
            existingRow.set(key, value);
          }
          continue;
        }

        // For other fields, only update if the new value is non-empty.
        if (
          !isNewValueEmpty ||
          ['ID', 'Дата фотосесії', 'Година фотосесії'].includes(key)
        ) {
          existingRow.set(key, value);
        }
      }
      await existingRow.save();
    } else {
      await sheet.addRow(rowData);
    }

    // Only send 'retouched' to GAS if it's true OR if it's a new row.
    // This ensures new rows get checkboxes, but existing rows preserve manual checks.
    const shouldSyncRetouched = !existingRow || !!booking.retouched;
    await this.triggerAutoSort(
      sheet.title,
      booking.id,
      shouldSyncRetouched ? !!booking.retouched : undefined,
    );
  }

  async deleteBooking(booking: Partial<BookingData>) {
    if (!booking.date) return;
    const sheet = await this.ensureMonthlySheet(booking.date);
    const rows = await sheet.getRows();

    const index = rows.findIndex(
      (r: GoogleSpreadsheetRow) => String(r.get('ID')) === String(booking.id),
    );

    if (index !== -1) {
      await rows[index].delete();
    }
  }

  private mapToRow(
    booking: BookingData,
  ): Record<string, string | number | boolean> {
    return {
      ID: booking.id || '',
      Залишок: booking.balance,
      'Дата фотосесії': booking.date,
      'Година фотосесії': booking.time,
      'Відретушовані фото': !!booking.retouched,
      'Тип фотосесії': booking.type,
      Тариф: booking.tariff,
      Завдаток: booking.deposit,
      Оплата: booking.payment,
      'Звідки дізнались': booking.source,
      'Чи вже були на фотосесії': booking.alreadyBeen,
      'К-ть фото': booking.photoCount,
      Фотограф: booking.photographer,
      'Екстра Фотограф': booking.extraPhotographer,
      'Оплата фотографу': booking.photographerPayment,
      'Публікація чи дозволена': booking.publicationAllowed,
      'Спосіб оплати': booking.paymentMethod,
      Посилання: booking.galleryLink,
      'ПІ клієнта': booking.clientName,
      'Номер телефону': booking.phone,
      'Ел пошта': booking.email,
      Місто: booking.city,
      'Статус та помилки': booking.status || '',
    };
  }

  async updateBookingStatus(id: string, date: string, status: string) {
    try {
      const sheet = await this.ensureMonthlySheet(date);
      const rows = await sheet.getRows();
      const row = rows.find(
        (r: GoogleSpreadsheetRow) => String(r.get('ID')) === String(id),
      );

      if (row) {
        row.set('Статус та помилки', status);
        await row.save();
        console.log(`✅ Status updated for booking ${id}: ${status}`);
      } else {
        console.warn(`⚠️ Could not find booking ${id} to update status`);
      }
    } catch (error) {
      console.error(`❌ Error updating status for booking ${id}:`, error);
    }
  }

  async triggerAutoSort(
    sheetName: string,
    bookingId?: string | number,
    retouched?: boolean,
  ) {
    const url = this.configService.get<string>(
      'GOOGLE_SCRIPT_SORT_URL',
    ) as string;
    const apiKey = this.configService.get<string>(
      'GOOGLE_SCRIPT_API_KEY',
    ) as string;

    const data = {
      'X-API-KEY': apiKey,
      sheetName: sheetName,
      id: bookingId,
      retouched: retouched,
    };

    try {
      await firstValueFrom(this.httpService.post(url, data));
      console.log(`✅ Запит на сортування аркуша "${sheetName}" відправлено`);
    } catch (error) {
      console.error(
        '❌ Помилка тригера:',
        error instanceof Error ? error.message : error,
      );
    }
  }
}
