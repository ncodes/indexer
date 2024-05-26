import { ConfigService } from '@nestjs/config';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Bot, GrammyError, HttpError } from 'grammy';
import { Menu } from '@grammyjs/menu';
import User from '../../models/user';
import { isProd } from '../../common/common';
import { RedisService } from '../../services/redis/redis.service';

@Injectable()
export class TGBotService implements OnModuleInit {
  logger = new Logger(TGBotService.name);
  bot: Bot;

  constructor(private cfgSrv: ConfigService, private redisSrv: RedisService) {
    this.bot = new Bot(cfgSrv.get('app.tgbot.token'));
  }

  async onModuleInit() {
    this.logger.log('TGBotService initialized');
    void this.initService();
  }

  async initService() {
    await this.bot.api.setMyCommands([
      { command: 'start', description: 'Start the bot' },
      { command: 'help', description: 'Show help text' },
      { command: 'settings', description: 'Open settings' },
    ]);

    const menu = this.createMenu();

    // Handle start command
    this.handleStart(menu);

    // Handle errors
    this.handleErrors();

    void this.bot.start();
  }

  createMenu() {
    const menu = new Menu('main')
      .webApp('🕹️ Play Game', 'https://jointapp.vercel.app/tapwar')
      .row()
      .url('🌎 Joint Web', 'https://joint.exchange')
      .row()
      .url('🖥️ Joint App', 'https://test.joint.exchange')
      .row()
      .url('👥 Community', 'https://t.me/jointHQ');

    this.bot.use(menu);

    return menu;
  }

  handleStart(menu: Menu) {
    this.bot.command('start', async (ctx) => {
      if (ctx.match && ctx.match.startsWith('ref-')) {
        void this.handleReferredUser(ctx.match.split('-')[1], ctx.from.id);
      }

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
  }

  /**
   * Handle a referred user starting the bot
   * @param referrerCode The referrer code
   * @param referredTgId The Telegram ID of the referred user
   */
  async handleReferredUser(referrerCode: string, referredTgId: number) {
    const getReferrerUser = await User.getByRefCode(referrerCode);
    const getReferredUser = await User.getByTelegramUserId(referredTgId);

    // In production, do not allow referral if referred user already exists
    if (isProd() && getReferredUser) return;

    // Mark the user as referred by the referrer in redis
    await this.redisSrv.set(buildReferredKey(referredTgId), getReferrerUser.address);
  }

  handleErrors() {
    this.bot.catch((err) => {
      const ctx = err.ctx;
      this.logger.error(`Error while handling update ${ctx.update.update_id}:`);
      const e = err.error;
      if (e instanceof GrammyError) {
        this.logger.error('Error in request:', e.description);
      } else if (e instanceof HttpError) {
        this.logger.error('Could not contact Telegram:', e);
      } else {
        this.logger.error('Unknown error:', e);
      }
    });
  }
}

export function buildReferredKey(tgId: number) {
  return `tg:referred:${tgId}`;
}
