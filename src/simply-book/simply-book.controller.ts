import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import {
  SimplyBookService,
  SimplyBookWebhookPayload,
} from './simply-book.service.js';
import { GoogleSheetsService } from '../google-sheets/google-sheets.service.js';
import { BookingData } from '../common/interfaces.js';

@Controller('webhooks/simplybook')
export class SimplyBookController {
  constructor(
    private simplyBookService: SimplyBookService,
    private googleSheetsService: GoogleSheetsService,
  ) {}

  @Post()
  @HttpCode(200)
  async handleWebhook(@Body() payload: SimplyBookWebhookPayload) {
    console.log('Received SimplyBook webhook:', payload);

    const notificationType = payload.notification_type || '';
    const bookingId = payload.booking_id;

    if (!bookingId) {
      console.warn('Webhook received without booking_id');
      return { status: 'ignored', reason: 'no_booking_id' };
    }

    try {
      if (notificationType === 'cancel') {
        // For cancellation, we might only need the ID, but mapToBooking needs a record
        // Create a dummy record with just the ID for deletion
        const dummyBooking: BookingData = {
          id: String(bookingId),
          date: '',
          time: '',
          retouched: false,
          type: '',
          tariff: '',
          deposit: '0',
          balance: '',
          payment: '',
          source: '',
          alreadyBeen: '',
          photoCount: '',
          photographer: '',
          extraPhotographer: '',
          photographerPayment: '',
          publicationAllowed: '',
          paymentMethod: '',
          galleryLink: '',
          clientName: '',
          phone: '',
          email: '',
          city: '',
        };
        await this.googleSheetsService.deleteBooking(dummyBooking);
        console.log(`Booking ${bookingId} cancelled and removed from sheets.`);
      } else if (
        notificationType === 'create' ||
        notificationType === 'change'
      ) {
        const fullBooking =
          await this.simplyBookService.getBookingDetails(bookingId);
        await this.googleSheetsService.upsertBooking(fullBooking);
        console.log(
          `Booking ${bookingId} ${notificationType}d and synced to sheets.`,
        );
      } else {
        console.log(`Ignored unknown notification type: ${notificationType}`);
      }
    } catch (error) {
      console.error(
        `Failed to process webhook for booking ${bookingId}:`,
        error,
      );
      // Still return 200 to SimplyBook to avoid retries if we can't handle it
    }

    return { status: 'success' };
  }

  @Post('migration/start')
  @HttpCode(200)
  async startMigration(@Body() body: { from?: string; to?: string }) {
    try {
      // Set default range: from today to 60 days ahead
      const fromDate = body.from || new Date().toISOString().split('T')[0];
      const future = new Date();
      future.setDate(future.getDate() + 60);
      const toDate = body.to || future.toISOString().split('T')[0];

      console.log(`Starting migration for period: ${fromDate} to ${toDate}`);

      const bookings = await this.simplyBookService.getBookings(
        fromDate,
        toDate,
      );

      console.log(`Found ${bookings.length} bookings to migrate.`);

      for (const booking of bookings) {
        await this.googleSheetsService.upsertBooking(booking);
      }

      return {
        status: 'success',
        message: 'Migration completed successfully',
        count: bookings.length,
        period: { from: fromDate, to: toDate },
      };
    } catch (error) {
      console.error('Migration failed:', error);
      return {
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unknown error during migration',
      };
    }
  }
}
