import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { AppName } from '../../common/common';
import * as cons from '@ladjs/consolidate';
import * as appRoot from 'app-root-path';
import * as path from 'path';
import * as handlebars from 'handlebars';
import * as HTMLToText from 'nodemailer-html-to-text';
import './handlebar-helpers';

@Injectable()
export class MailerService {
  trans: nodemailer.Transporter;
  constructor(private cfg: ConfigService) {
    this.trans = nodemailer.createTransport({
      host: 'email-smtp.us-east-1.amazonaws.com',
      port: 465,
      secure: true,
      auth: {
        user: cfg.get('app.aws.smtpUsername'),
        pass: cfg.get('app.aws.smtpPassword'),
      },
    });
    this.trans.use('compile', HTMLToText.htmlToText());
  }

  /**
   * send an email
   * @param {string} template The email template to be used.
   * @param {string} sub The subject of the mail
   * @param {string} to The recipient email address
   * @param locals The template's local data
   */
  async send(template: string, sub: string, to: string, locals: AnObject) {
    locals.app = AppName();

    const layout = await cons.handlebars(path.join(appRoot.path, 'emails/layout.html'), {
      body: `{{{body}}}`,
      title: `{{title}}`,
    });

    const html = handlebars.compile(layout)({
      body: await cons.handlebars(path.join(appRoot.path, `emails/${template}.hbs`), locals),
      title: locals?.title,
    });

    return this.trans.sendMail({
      from: `"${locals.app}" <no-reply@fiatx.co>`,
      to,
      subject: sub,
      html,
    });
  }

  async render(template: string, locals: AnObject): Promise<string> {
    return await cons.handlebars(path.join(appRoot.path, `emails/${template}.hbs`), locals);
  }
}
