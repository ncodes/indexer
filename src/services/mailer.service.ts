import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as temp from 'email-templates';
import * as nodemailer from 'nodemailer';
import { AppName } from './../common/common';

@Injectable()
export class MailerService {
  trans: nodemailer.Transporter;
  constructor(private cfg: ConfigService) {
    this.trans = nodemailer.createTransport({
      host: 'email-smtp.eu-west-2.amazonaws.com',
      port: 465,
      secure: true,
      auth: {
        user: cfg.get('app.aws.smtpUsername'),
        pass: cfg.get('app.aws.smtpPassword'),
      },
    });
  }

  /**
   * send sends an email
   * @param {string} template The email template to be used.
   * @param {string} sub The subject of the mail
   * @param {string} to The recipient email address
   * @param locals The template's local data
   */
  send(template: string, sub: string, to: string, locals: AnObject) {
    return new Promise(async (resolve, reject) => {
      const email = new temp({ views: { options: { extension: 'hbs' } } });
      locals.app = AppName();
      const output = await email.render(template, locals);
      this.trans
        .sendMail({
          from: `"${locals.app}" <no-reply@fiatx.co>`,
          to,
          subject: sub,
          html: output,
        })
        .then(resolve)
        .catch(reject);
    });
  }
}
