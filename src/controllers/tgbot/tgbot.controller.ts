import { Body, Controller, Post, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { buildReferredKey, TGBotService } from './tgbot.service';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { RegisterDTO } from './dto';
import { ConfigService } from '@nestjs/config';
import { verifyTelegramWebAppData } from './helpers';
import { ok, throw401 } from '../../common/responses/responses';
import User from '../../models/user';
import CacheService from '../../cacher/cache.service';
import * as moment from 'moment';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import { Request } from 'express';
import { RedisService } from '../../services/redis/redis.service';
import TapService from '../airdrop/tap.service';
import { RefereeBonus } from '../airdrop/constants';

/**
 * TGBotController handles Telegram bot capabilities
 */
@Controller('v1/tgbot')
export class TGBotController {
  constructor(
    private tgBotSrv: TGBotService,
    private tapSrv: TapService,
    private cfgSrv: ConfigService,
    private redisSrv: RedisService,
    private cacheSrv: CacheService,
  ) {}

  /**
   * Link a Telegram user to a Joint user
   * @param req The request object
   * @param body The request body
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Post('/link-user')
  async linkUser(@Req() req: Request, @Body(new ValidationPipe(ValPipeOpt)) body: RegisterDTO) {
    const isTgDataVerified = verifyTelegramWebAppData(body.initData, this.cfgSrv.get('app.tgbot.token'));
    if (!isTgDataVerified) {
      return throw401('Telegram auth failed');
    }

    // If the user has no referrer, check if the user was referred.
    // If so, set the referrer to the referrer's address.
    let referrer = req.user.referrer;
    if (!referrer) {
      referrer = await this.redisSrv.get(buildReferredKey(body.initDataUnsafe.user.id));
    }

    const user = await User.updateById(
      req.user.id,
      {
        referrer,
        telegramUserId: body.initDataUnsafe.user.id,
        telegramUsername: body.initDataUnsafe.user.username,
        telegramLastAuthAt: moment.unix(Number(body.initDataUnsafe.auth_date)).toISOString(),
      },
      this.cacheSrv.cacheUser.bind(this.cacheSrv),
    );

    // If the user was referred, delete the referrer key.
    // Also create referral bonus tap for the referred user.
    if (!req.user.referrer && referrer) {
      await this.redisSrv.delete(buildReferredKey(body.initDataUnsafe.user.id));
      await this.tapSrv.createTap({
        userId: user.id,
        bonus: true,
        bonusName: 'referee_bonus',
        bonusValue: RefereeBonus.toString(),
      });
    }

    return ok().data({ user: user.desensitize() }).build();
  }
}
