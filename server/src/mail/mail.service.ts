import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter!: Transporter;
  private from!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const host = this.config.get<string>('SMTP_HOST') ?? 'localhost';
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 1025);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const secure = this.config.get<string>('SMTP_SECURE') === 'true';

    this.from =
      this.config.get<string>('MAIL_FROM') ?? 'Parley <noreply@parley.local>';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass: pass ?? '' } : undefined,
    });

    this.logger.log(`SMTP transport configured (${host}:${port})`);
  }

  async send(opts: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }) {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      });
      this.logger.log(
        `Sent "${opts.subject}" to ${opts.to} (id=${info.messageId})`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send "${opts.subject}" to ${opts.to}: ${(err as Error).message}`,
      );
    }
  }

  appUrl(): string {
    return this.config.get<string>('APP_URL') ?? 'http://localhost:8080';
  }
}
