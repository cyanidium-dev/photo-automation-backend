import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';

@Injectable()
export class EmailService {
  private oauth2Client: InstanceType<typeof google.auth.OAuth2>;

  constructor(private configService: ConfigService) {
    this.oauth2Client = new google.auth.OAuth2(
      this.configService.get<string>('GMAIL_CLIENT_ID'),
      this.configService.get<string>('GMAIL_CLIENT_SECRET'),
      'https://developers.google.com/oauthplayground',
    );
    this.oauth2Client.setCredentials({
      refresh_token: this.configService.get<string>('GMAIL_REFRESH_TOKEN'),
    });
  }

  async sendMail(to: string, subject: string, html: string) {
    try {
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      // Формуємо MIME-повідомлення (заголовки + контент)
      // Використовуємо Base64 для теми, щоб підтримувати спецсимволи та емодзі
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const messageParts = [
        `From: Studio photo Yuliia S <${this.configService.get<string>('GMAIL_SMTP_USER')}>`,
        `To: ${to}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
        '',
        html,
      ];
      const message = messageParts.join('\n');

      // Gmail API очікує base64url формат (заміна + на - та / на _)
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      console.log(`Sending email via HTTP API to: ${to}...`);

      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      console.log('Email successfully sent! ID:', res.data.id);
      return res.data;
    } catch (error) {
      // Якщо токен протух, googleapis спробує його оновити автоматично,
      // але якщо помилка в самих credentials — ми побачимо її тут
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      console.error('Gmail HTTP API Error:', error.message);
      throw error;
    }
  }

  async sendGalleryLinkMail(
    to: string,
    clientName: string,
    galleryLink: string,
  ) {
    const subject = 'Vos photos sont prêtes !';
    const html = `
      <p>Bonjour,</p>
      <p>Vous trouverez ci-dessous le lien vers votre galerie en ligne contenant les photos de votre séance.</p>
      <p><a href="${galleryLink}">${galleryLink}</a></p>
      <p>Merci de sélectionner les photos à retoucher en fonction de votre formule.</p>
      <p>Une fois la sélection terminée, veuillez cliquer sur le bouton noir pour valider. Suite à cela, nous recevons une notification pour commencer à traiter vos photos.</p>
      <p>Nous vous informons que vous bénéficiez de 3 photos retouchées supplémentaires en cas où vous autorisez la publication de vos photos.</p>
      <p>Si vous avez la moindre question, nous serons ravis de vous aider.</p>
      <p>Nous vous souhaitons une belle découverte de vos photos 💛</p>
      <p>Cordialement,</p>
      <p><strong>Studio photo Yuliia S</strong></p>
    `;
    return this.sendMail(to, subject, html);
  }

  async sendReviewRequestMail(to: string) {
    const subject = 'Vos photos retouchées sont prêtes !';
    const reviewLink = 'https://g.page/r/CUD0UlxBaIr_EAE/review';
    const html = `
      <p>Bonjour,</p>
      <p>Nous sommes ravis de vous informer que vos photos ont été retouchées.</p>
      <p>Pensez à les télécharger en « Original size » afin de garder la qualité.</p>
      <p>Elles seront disponibles via le même lien dans la rubrique « photos retouchées » pendant 1 an. Passé ce délai, les photos seront automatiquement supprimées.</p>
      <p>Si vous avez apprécié cette expérience, n’hésitez pas à nous laisser un commentaire via ce lien:</p>
      <p><a href="${reviewLink}">${reviewLink}</a></p>
      <p>Nous avons par ailleurs le plaisir de vous offrir une remise de -10% sur votre prochaine séance photo!</p>
      <p>Merci pour votre confiance,</p>
      <p><strong>Studio photo Yuliia S</strong></p>
    `;
    return this.sendMail(to, subject, html);
  }
}
