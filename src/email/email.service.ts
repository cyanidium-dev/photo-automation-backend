import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    const smtpPort = Number(
      this.configService.get<string>('GMAIL_SMTP_PORT') || 465,
    );
    interface SMTPTransportOptions extends SMTPTransport.Options {
      family?: number;
    }

    const transportOptions: SMTPTransportOptions = {
      host: 'smtp.gmail.com',
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for 587
      auth: {
        user: this.configService.get<string>('GMAIL_SMTP_USER'),
        pass: this.configService.get<string>('GMAIL_SMTP_PASS'),
      },
      tls: {
        rejectUnauthorized: false,
      },
      // Force IPv4 to avoid ENETUNREACH on environments without IPv6 support
      family: 4,
    };
    this.transporter = nodemailer.createTransport(transportOptions);
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
