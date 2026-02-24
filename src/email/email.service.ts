import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: this.configService.get<string>('GMAIL_SMTP_USER'),
        pass: this.configService.get<string>('GMAIL_SMTP_PASS'),
      },
    });
  }

  async sendMail(to: string, subject: string, html: string) {
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('GMAIL_SMTP_USER'),
        to,
        subject,
        html,
      });
      console.log(`Email sent to ${to}`);
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  async sendGalleryLinkMail(
    to: string,
    clientName: string,
    galleryLink: string,
  ) {
    const subject = 'Ваші фотографії готові!';
    const html = `
      <h1>Вітаємо, ${clientName}!</h1>
      <p>Ваша фотосесія завершена. Ви можете переглянути та завантажити ваші фото за посиланням нижче:</p>
      <a href="${galleryLink}">${galleryLink}</a>
      <p>Дякуємо, що обрали нас!</p>
    `;
    return this.sendMail(to, subject, html);
  }

  async sendReviewRequestMail(to: string, clientName: string) {
    const subject = 'Ваші відретушовані фото готові!';
    const reviewLink = 'https://g.page/r/CUD0UlxBaIr_EAE/review';
    const html = `
      <h1>Вітаємо, ${clientName}!</h1>
      <p>Ваші фотографії вже відретушовані!</p>
      <p>Будемо дуже вдячні за ваш відгук на Google Maps:</p>
      <a href="${reviewLink}">${reviewLink}</a>
    `;
    return this.sendMail(to, subject, html);
  }
}
