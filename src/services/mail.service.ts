import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

class MailService {
  private transporter: Transporter | null = null;

  constructor() {
    if (config.mail.host) {
      this.transporter = nodemailer.createTransport({
        host: config.mail.host,
        port: config.mail.port,
        secure: config.mail.port === 465,
        auth: {
          user: config.mail.user,
          pass: config.mail.password,
        },
      });
    } else {
      logger.warn('Mail host not configured - emails will be logged only');
    }
  }

  async send(opts: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    attachments?: MailAttachment[];
  }): Promise<void> {
    if (!this.transporter) {
      logger.info(
        `[MOCK MAIL] To: ${opts.to} | Subject: ${opts.subject}` +
          (opts.attachments?.length
            ? ` | Attachments: ${opts.attachments.map((a) => a.filename).join(', ')}`
            : ''),
      );
      return;
    }
    try {
      await this.transporter.sendMail({
        from: config.mail.from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        attachments: opts.attachments,
      });
    } catch (err: any) {
      logger.error(`Failed to send email to ${opts.to}`, {
        error: err.message,
      });
    }
  }

  reminderTemplate(input: {
    name: string;
    eventTitle: string;
    eventDate: Date;
    venue: string;
    timeUntil: string;
    eventUrl: string;
  }) {
    const subject = `Reminder: ${input.eventTitle} is ${input.timeUntil} away`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1c1917;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="font-size: 22px; font-weight: 700;">Eventful</div>
        </div>
        <h1 style="font-size: 22px; margin: 0 0 16px;">Hi ${input.name},</h1>
        <p style="font-size: 16px; line-height: 1.6; color: #44403c;">
          A friendly nudge — <strong>${input.eventTitle}</strong> starts in ${input.timeUntil}.
        </p>
        <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <div style="font-size: 11px; color: #78716c; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">When</div>
          <div style="font-weight: 600; margin-bottom: 12px;">${input.eventDate.toUTCString()}</div>
          <div style="font-size: 11px; color: #78716c; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Where</div>
          <div style="font-weight: 600;">${input.venue}</div>
        </div>
        <p style="text-align: center; margin: 32px 0;">
          <a href="${input.eventUrl}" style="display: inline-block; padding: 12px 28px; background: #1c1917; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500;">View event</a>
        </p>
        <p style="color: #78716c; font-size: 13px; text-align: center; margin-top: 32px;">— The Eventful team</p>
      </div>`;
    const text = `${input.eventTitle} starts in ${input.timeUntil} at ${input.venue} on ${input.eventDate.toUTCString()}. ${input.eventUrl}`;
    return { subject, html, text };
  }

  ticketTemplate(input: {
    name: string;
    eventTitle: string;
    ticketNumber: string;
    eventDate: Date;
    venue: string;
    eventUrl?: string;
  }) {
    const subject = `Your ticket for ${input.eventTitle}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1c1917;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="font-size: 22px; font-weight: 700;">Eventful</div>
        </div>
        <div style="background: #1c1917; color: #fafaf9; padding: 28px 24px; border-radius: 12px; text-align: center; margin-bottom: 28px;">
          <div style="font-size: 12px; color: #ea580c; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 8px;">Ticket Confirmed</div>
          <div style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">${input.eventTitle}</div>
          <div style="font-size: 13px; opacity: 0.8;">${new Date(input.eventDate).toUTCString()}</div>
          <div style="font-size: 13px; opacity: 0.8;">${input.venue}</div>
        </div>
        <p style="font-size: 16px;">Hi ${input.name},</p>
        <p style="font-size: 15px; line-height: 1.6; color: #44403c;">
          Your ticket for <strong>${input.eventTitle}</strong> is attached as a PDF. It contains your unique QR code — just present it at the entrance.
        </p>
        <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center;">
          <div style="font-size: 11px; color: #78716c; text-transform: uppercase; letter-spacing: 0.05em;">Ticket number</div>
          <div style="font-family: 'SF Mono', Menlo, monospace; font-size: 16px; font-weight: 600; margin-top: 4px;">${input.ticketNumber}</div>
        </div>
        ${input.eventUrl ? `<p style="text-align: center; margin: 24px 0;"><a href="${input.eventUrl}" style="display: inline-block; padding: 10px 24px; background: #1c1917; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500;">View event</a></p>` : ''}
        <p style="color: #78716c; font-size: 13px; text-align: center; margin-top: 32px;">— The Eventful team</p>
      </div>`;
    return { subject, html };
  }
}

export const mailService = new MailService();
