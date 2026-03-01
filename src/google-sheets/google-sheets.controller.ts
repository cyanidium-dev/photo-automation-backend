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

    if (!email) {
      console.warn('Received update without email');
      return { status: 'ignored' };
    }

    if (eventType === 'gallery_link' && galleryLink) {
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

    if (eventType === 'retouched' && retouched === true) {
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

    return { status: 'no_action' };
  }

  @Post('trigger-sort')
  @HttpCode(200)
  async triggerSort(@Body() body: { sheetName?: string }) {
    const sheetName = body.sheetName || 'Sheet1';
    await this.googleSheetsService.triggerAutoSort(sheetName);
    return { status: 'sort_triggered', sheetName };
  }
}
