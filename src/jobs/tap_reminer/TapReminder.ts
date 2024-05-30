import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Base } from '../base';
import TapService from '../../controllers/airdrop/tap.service';
import * as moment from 'moment';
import CacheService from '../../cacher/cache.service';
import { TGBotService } from '../../controllers/tgbot/tgbot.service';
import { InlineKeyboard } from 'grammy';

/**
 * BattleManager manages daily battle progress and calculations
 */
@Injectable()
export default class TapReminder extends Base {
  private logger = new Logger(TapReminder.name);

  constructor(
    private cfgSrv: ConfigService,
    private tapSrv: TapService,
    private cacheSrv: CacheService,
    private tgBotSrv: TGBotService,
  ) {
    super();
    this.schedule();
  }

  @Cron(process.env.TAP_REMINDER_CRON)
  schedule() {
    this.process().catch((e) => this.logger.error(e.message || 'failed to get exchange rate'));
  }

  async process() {
    try {
      if (this.isProcessing()) return;
      this.setProcessing(true);

      this.logger.log('Sending Tap reminders');

      const players = await this.tapSrv.getPlayers();
      if (!players.length) return;

      const tapReminderInterval = parseInt(this.cfgSrv.get('app.tgbot.tapReminderInterval'));

      for (const userId of players) {
        const lastTapAt = await this.tapSrv.getUserLastTapTime(userId);
        if (lastTapAt && moment().diff(moment.unix(parseInt(lastTapAt)), 'second') < tapReminderInterval) {
          continue;
        }

        const lastReminderSentTime = await this.tapSrv.getLastReminderSentTime(userId);
        if (lastReminderSentTime && moment().diff(moment.unix(lastReminderSentTime), 'second') < tapReminderInterval) {
          continue;
        }

        const user = await this.cacheSrv.getUserByUserId(userId);
        if (!user || !user.telegramBotChatId) continue;

        try {
          await this.tgBotSrv.sendMessage(
            user.telegramBotChatId,
            `Hey Warrior! It's time to tap again! 💪.
          The battle is still on and all your comrades are waiting for you to tap.
          Let's go! 🚀`,
            { reply_markup: new InlineKeyboard().webApp('🕹️Play', this.cfgSrv.get('app.tgbot.tapWarLink')) },
          );
          this.logger.log(`Sent Tap reminder to user ${userId}`);
        } catch (e) {
          this.logger.error(`Failed to send Tap reminder to user ${userId}`, e);
        }

        await this.tapSrv.setLastReminderSentTime(userId, moment().unix());
      }
    } catch (e) {
      this.logger.error(e.message);
      return e;
    } finally {
      this.setProcessing(false);
    }
  }
}
