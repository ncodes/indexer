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
import { Roles } from '../../common/roles';
import { Wallet } from 'ethers';
import { transaction } from 'objection';
import { makeSession } from '../auth/utils';
import { UserService } from '../users/user.service';
import { isProd } from '../../common/common';

/**
 * TGBotController handles Telegram bot capabilities
 */
@Controller('v1/tgbot')
export class TGBotController {
  constructor(
    private userSrv: UserService,
    private tapSrv: TapService,
    private tgSrv: TGBotService,
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

    // Find existing user with matching telegram user id
    const existingTelegramUser = await User.getByTelegramUserId(body.initDataUnsafe.user.id);
    if (existingTelegramUser.id !== req.user.id) {
      return throw401('Telegram account already linked to another account');
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

  /**
   * Create a Telegram linked user
   * @param body The request body
   */
  @Post('/linked-user')
  async createTelegramLinkedAccount(@Body(new ValidationPipe(ValPipeOpt)) body: RegisterDTO) {
    const isTgDataVerified = verifyTelegramWebAppData(body.initData, this.cfgSrv.get('app.tgbot.token'));
    if (!isTgDataVerified) {
      return throw401('Telegram auth failed');
    }

    // If the user has no referrer, check if the user was referred.
    // If so, set the referrer to the referrer's address.
    let referrer = await this.redisSrv.get(buildReferredKey(body.initDataUnsafe.user.id));

    // Get existing telegram linked user. Create it if it doesn't exist.
    let user = await User.getByTelegramUserId(body.initDataUnsafe.user.id);
    let privateKey = '';
    let chatId: number;
    let isUserNew = false;
    await transaction(User, async (User) => {
      if (!user) {
        const genWallet = Wallet.createRandom();
        privateKey = genWallet.privateKey;
        chatId = await this.tgSrv.getChatId(body.initDataUnsafe.user.id);
        isUserNew = true;
        user = await User.create(
          {
            address: genWallet.address,
            referrer,
            role: Roles.TelegramLinkedUser,
            telegramUsername: body.initDataUnsafe.user.username,
            telegramUserId: body.initDataUnsafe.user.id,
            telegramLastAuthAt: moment.unix(Number(body.initDataUnsafe.auth_date)).toISOString(),
            telegramBotChatId: chatId,
          },
          this.cacheSrv.cacheUser.bind(this.cacheSrv),
        );
      }

      if (privateKey) {
        await this.tgSrv.bot.api.sendMessage(
          chatId,
          `<b>Your TapWar Wallet private key</>:
${privateKey}`,
          {
            parse_mode: 'HTML',
          },
        );
        await this.tgSrv.bot.api.sendMessage(
          chatId,
          `<b>Use the key to</b>:
✅ <b>Connect to your TapWar wallet outside Telegram.</b>
✅ <b>Purchase in-game asset for use in the game (ex: $BOND, $MULTI).</b>
✅ <b>Withdraw your reward from the game.</b>

<b>Important:</b>
⛔️ <b>DO NOT SHARE WITH ANYONE. KEEP IT SAFE AND SECURE.</b>
⛔️ <b>WE DO NOT KEEP A COPY OR A BACKUP OF THE KEY.</b>`,
          { parse_mode: 'HTML' },
        );
      }
    });

    const token = await makeSession(user, undefined, '10080', this.cfgSrv.get('auth.jwtSecret'));
    if (isProd()) await this.userSrv.registerDevice(user);
    await this.userSrv.enableReferrerOps(isUserNew, '', user);

    // If the user was referred, delete the referrer key.
    // Also create referral bonus tap for the referred user.
    if (referrer) {
      await this.redisSrv.delete(buildReferredKey(body.initDataUnsafe.user.id));
      await this.tapSrv.createTap({
        userId: user.id,
        bonus: true,
        bonusName: 'referee_bonus',
        bonusValue: RefereeBonus.toString(),
      });
    }

    return ok().data({ user: user.desensitize(), token }).build();
  }
}
