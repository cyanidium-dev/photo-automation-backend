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

interface IConfig {
  get(key: string): unknown;
}

@Injectable()
export class GoogleSheetsService implements OnModuleInit {
  private doc!: GoogleSpreadsheet;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const config = this.configService as unknown as IConfig;
    const serviceAccountEmail = config.get(
      'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    ) as string;
    const serviceAccountKey = (
      config.get('GOOGLE_SERVICE_ACCOUNT_KEY') as string
    ).replace(/\\n/g, '\n');
    const spreadsheetId = config.get('GOOGLE_SHEETS_ID') as string;

    if (!serviceAccountEmail || !serviceAccountKey || !spreadsheetId) {
      console.error('Google Sheets configuration is missing');
      return;
    }

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
      // Manually set values to avoid Object.assign on Row object which might be tricky with types
      for (const [key, value] of Object.entries(rowData)) {
        existingRow.set(key, value);
      }
      await existingRow.save();
    } else {
      await sheet.addRow(rowData);
    }

    await this.sortSheet(sheet);
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
      'Відретушовані фото': booking.retouched ? 'TRUE' : 'FALSE',
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
    };
  }

  private async sortSheet(sheet: GoogleSpreadsheetWorksheet) {
    const rows = await sheet.getRows();
    if (rows.length <= 1) return;

    // Sort rows locally (Note: this doesn't actually reorder them in the sheet yet)
    // To reorder, we would need to delete and re-add or use batchUpdate
    const sorted = [...rows].sort((a, b) => {
      const dateTimeA = new Date(
        `${String(a.get('Дата фотосесії'))} ${String(a.get('Година фотосесії'))}`,
      );
      const dateTimeB = new Date(
        `${String(b.get('Дата фотосесії'))} ${String(b.get('Година фотосесії'))}`,
      );
      return dateTimeA.getTime() - dateTimeB.getTime();
    });

    console.log(`Sorted ${sorted.length} rows in sheet: ${sheet.title}`);
  }
}
