import * as cons from '@ladjs/consolidate';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as appRoot from 'app-root-path';
import * as handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';
import * as HTMLToText from 'nodemailer-html-to-text';
import * as path from 'path';
import { AppName } from '../../common/common';
import './handlebar-helpers';

@Injectable()
export class MailerService {
  logger = new Logger(MailerService.name);
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
   * @param template The email template to be used.
   * @param sub The subject of the mail
   * @param to The recipient email address
   * @param locals The template's local data
   * @param throwError Throw error if sending fails or just log it
   */
  async send(template: string, sub: string, to: string, locals: AnObject, throwError = false) {
    locals.app = AppName();

    const layout = await cons.handlebars(path.join(appRoot.path, 'emails/layout.html'), {
      body: `{{{body}}}`,
      title: `{{title}}`,
    });

    const html = handlebars.compile(layout)({
      body: await cons.handlebars(path.join(appRoot.path, `emails/${template}.hbs`), locals),
      title: locals?.title,
    });

    try {
      const resp = await this.trans.sendMail({
        from: `${locals.app} <no-reply@joint.exchange>`,
        to,
        subject: sub,
        html,
      });
      return resp;
    } catch (error) {
      if (throwError) throw error;
      else this.logger.error(error.message);
    }
  }

  async render(template: string, locals: AnObject): Promise<string> {
    return await cons.handlebars(path.join(appRoot.path, `emails/${template}.hbs`), locals);
  }
}
