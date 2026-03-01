import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingData } from '../common/interfaces.js';
import axios from 'axios';

export class SimplyBookResponse<T> {
  token?: string;
  data?: T;
  error?: {
    code: number;
    message: string;
  };
}

interface IConfig {
  get(key: string): unknown;
}

interface IAxios {
  (config: unknown): Promise<{ data: unknown }>;
}

export class SimplyBookRecord {
  id!: string | number;
  start_datetime?: string;
  start_date?: string;
  service_name?: string;
  unit_price?: string | number;
  deposit_price?: string | number;
  performer_name?: string;
  client?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  client_name?: string;
  client_phone?: string;
  client_email?: string;
  location?: string;
}

export class SimplyBookWebhookPayload {
  booking_id?: string;
  booking_hash?: string;
  company?: string;
  notification_type?: string;
  webhook_timestamp?: number;
  signature_algo?: string;
  data?: SimplyBookRecord;
  event?: string;
  [key: string]: unknown;
}

@Injectable()
export class SimplyBookService {
  private userApiUrl = 'https://user-api-v2.simplybook.me';
  private loginApiUrl = 'https://user-api-v2.simplybook.me/admin/auth';

  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private configService: ConfigService) {}

  /**
   * Gets an authentication token from SimplyBook.me.
   */
  async getToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && now < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    const config = this.configService as unknown as IConfig;
    const companyLogin = config.get('SIMPLYBOOK_COMPANY_LOGIN') as string;
    const userLogin = config.get('SIMPLYBOOK_USER_LOGIN') as string;
    const userPassword = config.get('SIMPLYBOOK_USER_PASSWORD') as string;

    const ax = axios as unknown as IAxios;
    const response = (await ax({
      method: 'post',
      url: this.loginApiUrl,
      data: {
        company: companyLogin,
        login: userLogin,
        password: userPassword,
      },
    })) as { data: SimplyBookResponse<string> };
    const data = response.data;
    console.log('Token data:', data);

    if (data.error) {
      const errorMessage = String(
        data.error.message || 'Unknown SimplyBook Error',
      );
      throw new Error(`SimplyBook Auth Error: ${errorMessage}`);
    }

    if (!data.token) {
      throw new Error('SimplyBook Auth Error: Token is missing in response');
    }

    this.cachedToken = data.token;
    // Cache for 55 minutes (tokens usually last 60m)
    this.tokenExpiresAt = now + 55 * 60 * 1000;

    return data.token;
  }
  /**
   * Fetches bookings from SimplyBook for a specific date range.
   */
  async getBookings(from: string, to: string): Promise<BookingData[]> {
    const config = this.configService as unknown as IConfig;
    const companyLogin =
      (config.get('SIMPLYBOOK_COMPANY_LOGIN') as string) || '';
    const token = await this.getToken();

    const ax = axios as unknown as IAxios;
    const response = (await ax({
      method: 'get',
      url: `${this.userApiUrl}/admin/bookings`,
      params: {
        'filter[date_from]': from,
        'filter[date_to]': to,
      },
      headers: {
        'X-Company-Login': companyLogin,
        'X-Token': token,
      },
    })) as {
      data: SimplyBookRecord[] | SimplyBookResponse<SimplyBookRecord[]>;
    };
    const data = response.data;

    // REST V2 might return data directly or wrapped
    const bookings = Array.isArray(data) ? data : data.data || [];

    return bookings.map((b: SimplyBookRecord) => this.mapToBooking(b));
  }

  /**
   * Fetches full booking details by ID.
   */
  async getBookingDetails(id: string | number): Promise<BookingData> {
    const config = this.configService as unknown as IConfig;
    const companyLogin =
      (config.get('SIMPLYBOOK_COMPANY_LOGIN') as string) || '';
    const token = await this.getToken();

    const ax = axios as unknown as IAxios;
    const response = (await ax({
      method: 'get',
      url: `${this.userApiUrl}/admin/bookings/${id}`,
      headers: {
        'X-Company-Login': companyLogin,
        'X-Token': token,
      },
    })) as { data: SimplyBookRecord };
    const data = response.data;

    if (!data || !data.id) {
      throw new Error(`SimplyBook API Error: No details found for ID ${id}`);
    }

    return this.mapToBooking(data);
  }

  private mapToBooking(data: SimplyBookRecord): BookingData {
    const client = data.client || {};
    const fullDate = data.start_datetime || data.start_date || '';
    const [startDate, startTime] = fullDate.split(' ');

    return {
      id: String(data.id),
      balance: '',
      date: startDate,
      time: startTime,
      retouched: false,
      type: String(data.service_name || ''),
      tariff: String(data.unit_price || ''),
      deposit: String(data.deposit_price || '0'),
      payment: '',
      source: '',
      alreadyBeen: '',
      photoCount: '',
      photographer: String(data.performer_name || ''),
      extraPhotographer: '',
      photographerPayment: '',
      publicationAllowed: '',
      paymentMethod: '',
      galleryLink: '',
      clientName: String(client.name || data.client_name || ''),
      phone: String(client.phone || data.client_phone || ''),
      email: String(client.email || data.client_email || ''),
      city: String(data.location || ''),
      status: 'запис оновлено',
    };
  }
}
