import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';

type DriftEmailPayload = {
  to: string;
  recipientName: string;
  portfolioName: string;
  ticker: string;
  companyName: string;
  currentWeight: number;
  driftThreshold: number;
};

type VerificationOtpEmailPayload = {
  to: string;
  recipientName: string;
  otpCode: string;
  expiresInMinutes: number;
};

@Injectable()
export class AlertsEmailService {
  private readonly logger = new Logger(AlertsEmailService.name);
  private transporter: Transporter | null = null;

  isConfigured() {
    // AlertsEmailService flow:
    // Check whether the minimum Gmail SMTP credentials are available before email delivery is attempted.
    return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
  }

  async sendDriftAlertEmail(payload: DriftEmailPayload) {
    // sendDriftAlertEmail flow:
    // Validate the Gmail SMTP configuration and derive the sender metadata for the outbound alert email.
    if (!this.isConfigured()) {
      throw new Error(
        'Gmail email configuration is missing. Set GMAIL_USER and GMAIL_APP_PASSWORD.',
      );
    }

    const transporter = this.getTransporter();
    const fromEmail = process.env.ALERTS_FROM_EMAIL ?? process.env.GMAIL_USER;
    const fromName = process.env.ALERTS_FROM_NAME ?? 'Portfolio Drift Monitor';
    const subject = `Drift detected for ${payload.ticker}`;

    // sendDriftAlertEmail flow:
    // Deliver both the text and HTML variants of the drift email through the cached Nodemailer transporter.
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: payload.to,
      subject,
      text: this.buildTextBody(payload),
      html: this.buildHtmlBody(payload),
    });

    this.logger.log(
      `Drift alert email sent to ${payload.to} for ${payload.ticker}`,
    );
  }

  async sendVerificationOtpEmail(payload: VerificationOtpEmailPayload) {
    // sendVerificationOtpEmail flow:
    // Validate the Gmail SMTP configuration and derive the sender metadata for the outbound OTP email.
    if (!this.isConfigured()) {
      throw new Error(
        'Gmail email configuration is missing. Set GMAIL_USER and GMAIL_APP_PASSWORD.',
      );
    }

    const transporter = this.getTransporter();
    const fromEmail = process.env.ALERTS_FROM_EMAIL ?? process.env.GMAIL_USER;
    const fromName = process.env.ALERTS_FROM_NAME ?? 'Portfolio Drift Monitor';
    const subject = 'Verify your email address';

    // sendVerificationOtpEmail flow:
    // Deliver both the text and HTML variants of the verification email through the cached Nodemailer transporter.
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: payload.to,
      subject,
      text: this.buildVerificationOtpTextBody(payload),
      html: this.buildVerificationOtpHtmlBody(payload),
    });

    this.logger.log(`Verification OTP email sent to ${payload.to}`);
  }

  private getTransporter() {
    // getTransporter helper:
    // Reuse a single Nodemailer transporter instance so repeated alert sends do not recreate the SMTP client.
    if (this.transporter) {
      return this.transporter;
    }

    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    return this.transporter;
  }

  private buildTextBody(payload: DriftEmailPayload) {
    // buildTextBody helper:
    // Compose the plain-text email body for clients that do not render HTML.
    return [
      `Hello ${payload.recipientName},`,
      '',
      `A drift event was detected in your portfolio "${payload.portfolioName}".`,
      `${payload.ticker} (${payload.companyName}) currently has an allocation weight of ${payload.currentWeight.toFixed(1)}%.`,
      `Your drift threshold for this portfolio is ${payload.driftThreshold.toFixed(1)}%.`,
      '',
      'Please review your portfolio allocation in the application.',
      '',
      'Portfolio Drift Monitor',
    ].join('\n');
  }

  private buildHtmlBody(payload: DriftEmailPayload) {
    // buildHtmlBody helper:
    // Compose the HTML email body for the drift alert notification.
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <p>Hello ${escapeHtml(payload.recipientName)},</p>
        <p>
          A drift event was detected in your portfolio
          <strong>${escapeHtml(payload.portfolioName)}</strong>.
        </p>
        <p>
          <strong>${escapeHtml(payload.ticker)}</strong>
          (${escapeHtml(payload.companyName)}) currently has an allocation weight of
          <strong>${payload.currentWeight.toFixed(1)}%</strong>.
        </p>
        <p>
          Your drift threshold for this portfolio is
          <strong>${payload.driftThreshold.toFixed(1)}%</strong>.
        </p>
        <p>Please review your portfolio allocation in the application.</p>
        <p>Portfolio Drift Monitor</p>
      </div>
    `;
  }

  private buildVerificationOtpTextBody(payload: VerificationOtpEmailPayload) {
    // buildVerificationOtpTextBody helper:
    // Compose the plain-text email body for email-verification OTP delivery.
    return [
      `Hello ${payload.recipientName},`,
      '',
      'Use the OTP below to verify your email address:',
      '',
      payload.otpCode,
      '',
      `This OTP expires in ${payload.expiresInMinutes} minute(s).`,
      '',
      'If you did not create this account, you can ignore this email.',
      '',
      'Portfolio Drift Monitor',
    ].join('\n');
  }

  private buildVerificationOtpHtmlBody(payload: VerificationOtpEmailPayload) {
    // buildVerificationOtpHtmlBody helper:
    // Compose the HTML email body for email-verification OTP delivery.
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <p>Hello ${escapeHtml(payload.recipientName)},</p>
        <p>Use the OTP below to verify your email address:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 24px 0;">
          ${escapeHtml(payload.otpCode)}
        </p>
        <p>This OTP expires in <strong>${payload.expiresInMinutes} minute(s)</strong>.</p>
        <p>If you did not create this account, you can ignore this email.</p>
        <p>Portfolio Drift Monitor</p>
      </div>
    `;
  }
}

function escapeHtml(value: string) {
  // escapeHtml helper:
  // Escape dynamic strings before interpolating them into the HTML email template.
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
