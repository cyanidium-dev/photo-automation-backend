import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
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
      const { token } = await this.oauth2Client.getAccessToken();
      if (!token) {
        throw new Error('Failed to generate Gmail access token');
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: this.configService.get<string>('GMAIL_SMTP_USER'),
          clientId: this.configService.get<string>('GMAIL_CLIENT_ID'),
          clientSecret: this.configService.get<string>('GMAIL_CLIENT_SECRET'),
          refreshToken: this.configService.get<string>('GMAIL_REFRESH_TOKEN'),
          accessToken: token,
        },
      } as unknown as nodemailer.TransportOptions);

      await transporter.sendMail({
        from: `Studio photo Yuliia S <${this.configService.get<string>('GMAIL_SMTP_USER')}>`,
        to,
        subject,
        html,
      });

      console.log(`Email sent via Gmail API to ${to}`);
    } catch (error) {
      console.error('Gmail API Error:', error);
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
