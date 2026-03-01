import {
  Controller,
  Post,
  Body,
  HttpCode,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service.js';
import { GoogleSheetsService } from './google-sheets.service.js';

export class SheetsUpdatePayload {
  id?: string;
  date?: string;
  clientName?: string;
  email?: string;
  galleryLink?: string;
  retouched?: boolean;
  eventType?: string;
}

@Controller('webhooks/sheets')
export class GoogleSheetsController {
  constructor(
    private emailService: EmailService,
    private configService: ConfigService,
    private googleSheetsService: GoogleSheetsService,
  ) {}

  @Post('update')
  @HttpCode(200)
  async handleSheetUpdate(
    @Body() payload: SheetsUpdatePayload,
    @Headers('x-api-key') apiKey: string,
  ) {
    const validKey = this.configService.get<string>('GOOGLE_SCRIPT_API_KEY');
    if (apiKey !== validKey) {
      console.warn(`Unauthorized webhook attempt with key: ${apiKey}`);
      throw new UnauthorizedException('Invalid API Key');
    }

    console.log('Received Sheets update webhook:', payload);

    // Expecting payload: { id, date, clientName, email, galleryLink, retouched, eventType }
    const { id, date, clientName, email, galleryLink, retouched, eventType } =
      payload;

    // Basic validation for finding the row
    if (!id && !email) {
      console.warn('Received update without ID and without Email');
      return { status: 'ignored', reason: 'no_identifier' };
    }

    if (!date) {
      console.warn('Received update without Date');
      return { status: 'ignored', reason: 'no_date' };
    }

    // Validation for specific events
    if (eventType === 'gallery_link') {
      if (!email) {
        await this.googleSheetsService.updateBookingStatus(
          id,
          date,
          'помилка: відсутня ел. пошта',
        );
        return { status: 'error', reason: 'missing_email' };
      }
      if (!galleryLink) {
        await this.googleSheetsService.updateBookingStatus(
          id,
          date,
          'помилка: відсутнє посилання на галерею',
          email,
        );
        return { status: 'error', reason: 'missing_gallery_link' };
      }

      try {
        await this.emailService.sendGalleryLinkMail(
          email,
          clientName || '',
          galleryLink,
        );
        await this.googleSheetsService.updateBookingStatus(
          id,
          date,
          'відправлен лист 1',
          email,
        );
        return { status: 'sent_gallery_link' };
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        await this.googleSheetsService.updateBookingStatus(
          id,
          date,
          `помилка відправки листа 1: ${errorMsg}`,
          email,
        );
        throw error;
      }
    }

    if (eventType === 'retouched') {
      if (!email) {
        await this.googleSheetsService.updateBookingStatus(
          id,
          date,
          'помилка: відсутня ел. пошта',
        );
        return { status: 'error', reason: 'missing_email' };
      }
      if (retouched !== true) {
        await this.googleSheetsService.updateBookingStatus(
          id,
          date,
          'помилка: відсутня відмітка про ретуш',
          email,
        );
        return { status: 'error', reason: 'not_retouched' };
      }

      try {
        await this.emailService.sendReviewRequestMail(email);
        await this.googleSheetsService.updateBookingStatus(
          id,
          date,
          'відправлен лист 2',
          email,
        );
        return { status: 'sent_review_request' };
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        await this.googleSheetsService.updateBookingStatus(
          id,
          date,
          `помилка відправки листа 2: ${errorMsg}`,
          email,
        );
        throw error;
      }
    }

    // If event type is unknown or not handled
    if (id && date) {
      await this.googleSheetsService.updateBookingStatus(
        id,
        date,
        `помилка: невідомий тип події (${eventType})`,
        email,
      );
    }
  }

  @Post('trigger-sort')
  @HttpCode(200)
  async triggerSort(@Body() body: { sheetName?: string }) {
    const sheetName = body.sheetName || 'Sheet1';
    await this.googleSheetsService.triggerAutoSort(sheetName);
    return { status: 'sort_triggered', sheetName };
  }
}
