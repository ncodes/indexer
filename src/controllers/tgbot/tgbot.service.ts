import { ConfigService } from '@nestjs/config';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Bot, GrammyError, HttpError } from 'grammy';
import { Menu } from '@grammyjs/menu';

@Injectable()
export class TGBotService implements OnModuleInit {
  logger = new Logger(TGBotService.name);
  bot: Bot;

  constructor(private cfgSrv: ConfigService) {
    this.bot = new Bot(cfgSrv.get('app.tgbot.token'));
  }

  async onModuleInit() {
    this.logger.log('TGBotService initialized');
    this.initService();
  }

  async initService() {
    // Create a simple menu.
    const menu = new Menu('main')
      .webApp('🕹️ Play Game', 'https://test.joint.exchange/tapwar')
      .row()
      .url('🌎 Joint Web', 'https://joint.exchange')
      .row()
      .url('🖥️ Joint App', 'https://test.joint.exchange')
      .row()
      .url('👥 Community', 'https://t.me/jointHQ');

    this.bot.use(menu);

    this.bot.command('start', async (ctx) => {
      await ctx.replyWithPhoto('https://files.joint.exchange/images/tgbot_welcome2.png', {
        caption: `
Hey @${ctx.from.username}! Welcome to Joint's <b>TapWar game!</b>

Joint is a decentralized peer-to-peer exchanage that allows you to trade tokens with other users directly. 

We are getting ready to launch the JOIN tokens. <b>TapWar</b> is one way to earn JOIN tokens! We invite you to PLAY! 🕹️

Jump in and start playing TapWar to earn JOIN tokens. Invite your friends and communities. The more invites the higher your JOINs. 
`,
        parse_mode: 'HTML',
        reply_markup: menu,
      });
    });

    await this.bot.api.setMyCommands([
      { command: 'start', description: 'Start the bot' },
      { command: 'help', description: 'Show help text' },
      { command: 'settings', description: 'Open settings' },
    ]);

    this.bot.command('add', async (ctx) => {
      const item = ctx.match;
      console.log(item);
    });

    this.bot.catch((err) => {
      const ctx = err.ctx;
      console.error(`Error while handling update ${ctx.update.update_id}:`);
      const e = err.error;
      if (e instanceof GrammyError) {
        console.error('Error in request:', e.description);
      } else if (e instanceof HttpError) {
        console.error('Could not contact Telegram:', e);
      } else {
        console.error('Unknown error:', e);
      }
    });

    void this.bot.start();
  }
}
