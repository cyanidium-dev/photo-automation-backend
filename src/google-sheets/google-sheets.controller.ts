import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { EmailService } from '../email/email.service.js';

export class SheetsUpdatePayload {
  clientName?: string;
  email?: string;
  galleryLink?: string;
  retouched?: boolean;
  eventType?: string;
}

@Controller('webhooks/sheets')
export class GoogleSheetsController {
  constructor(private emailService: EmailService) {}

  @Post('update')
  @HttpCode(200)
  async handleSheetUpdate(@Body() payload: SheetsUpdatePayload) {
    console.log('Received Sheets update webhook:', payload);

    // Expecting payload: { clientName, email, galleryLink, retouched, type }
    const { clientName, email, galleryLink, retouched, eventType } = payload;

    if (!email) {
      console.warn('Received update without email');
      return { status: 'ignored' };
    }

    if (eventType === 'gallery_link' && galleryLink) {
      await this.emailService.sendGalleryLinkMail(
        email,
        clientName || '',
        galleryLink,
      );
      return { status: 'sent_gallery_link' };
    }

    if (eventType === 'retouched' && retouched === true) {
      await this.emailService.sendReviewRequestMail(email, clientName || '');
      return { status: 'sent_review_request' };
    }

    return { status: 'no_action' };
  }
}
