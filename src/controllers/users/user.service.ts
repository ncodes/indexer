import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { transaction } from 'objection';
import CacheService from '../../cacher/cache.service';
import { isEqualStr, isLocal, randStr, toDec } from '../../common/common';
import Allocation from '../../models/allocations';
import BadgeGrant from '../../models/badge_grant';
import NFTOwner from '../../models/nft_owner';
import { defaultNotificationSettings } from '../../models/notification_setting';
import MarketManagerDelegate from '../../models/pay_router_delegate';
import PaymentMethod from '../../models/payment_method';
import Point from '../../models/point';
import Swap from '../../models/swap';
import User from '../../models/user';
import { JointLinkService } from '../../services/joint_link.service';
import AirdropService from '../airdrop/airdrop.service';
import { RefereeBonus } from '../airdrop/constants';
import TapService from '../airdrop/tap.service';
import ConvosService from '../convos/convos.service';
import { NFTAllocations } from '../points/data/nft_allocation';
import { DeviceType } from './dto';

@Injectable()
export class UserService {
  logger = new Logger(UserService.name);

  constructor(
    private chatNotifSrv: ConvosService,
    private jntLinkSrv: JointLinkService,
    private cfgSrv: ConfigService,
    private airdropSrv: AirdropService,
    private cacheSrv: CacheService,
    private tapSrv: TapService,
  ) {}

  /**
   * Extend user with peripheral and derived data
   * @param user The user object
   * @param network The network name
   * @returns
   */
  async extendUser(user: User, network?: string) {
    try {
      user.paymentMethod = await PaymentMethod.getById(user.defaultPaymentMethodId);

      const totalSwaps = await Swap.countByStatus({
        network,
        marketAddress: undefined,
        provider: undefined,
        providerOrTaker: user.address,
        released: undefined,
        cancelled: false,
        instant: false,
        disputed: undefined,
      });
      user.totalSwaps = parseInt(totalSwaps);

      user.completionRate = await Swap.getCompletionRate(network, undefined, undefined, user.address);

      const badges = await BadgeGrant.search(network, undefined, undefined, user.address);
      user.badges = (badges as BadgeGrant[]).map((b) => {
        const arr = [b.badge];
        if (b.path) arr.push(b.path);
        return arr.join('/');
      });

      user.volume = await Swap.getVolume(network, undefined, undefined, undefined, user.address);
      user.volumeUsd = toDec(
        await Swap.getVolume(
          network,
          undefined,
          undefined,
          undefined,
          user.address,
          undefined,
          undefined,
          undefined,
          true,
        ),
      )
        .toDP(0)
        .toNumber();

      const lastSwap = await Swap.getRecentSwap(network, user.address, undefined);
      user.lastActiveAt = undefined;
      if (lastSwap) {
        if (lastSwap.instant) {
          user.lastActiveAt = lastSwap.createdAt;
        } else {
          if (lastSwap.getPayer() == user.address) {
            user.lastActiveAt = lastSwap.paid ? lastSwap.paidAt : lastSwap.createdAt;
          } else {
            user.lastActiveAt =
              lastSwap.released && isEqualStr(user.address, lastSwap.finalizer || '')
                ? lastSwap.finalizedAt
                : lastSwap.createdAt;
          }
        }
      }

      user.notificationSettings = user.notificationSettings || defaultNotificationSettings;

      user.totalUnclaimedAlloc = await Allocation.getTotalUnclaimed(user.address, user.id);

      // Points allocation information
      user.points = parseInt(await Point.getTotalPointsByAddress(user.address));
      // user.rank = await Point.getRankByAddress(user.address);
      user.pointsAllocs = 0; // TODO: use proper calculation
      user.pointsAllocsClaimed = !!(await Allocation.getByName(`points:${user.address}`));

      // NFT allocation information
      const nftsOwned = await NFTOwner.findByAddress(user.address);
      user.nft = { count: nftsOwned.length, totalAlloc: 0, claimed: false };
      if (isLocal()) {
        for (const n of nftsOwned) {
          user.nft.totalAlloc = (user.nft.totalAlloc ?? 0) + NFTAllocations[n.tokenId.toString()];
        }
      }
      user.nft.claimed = !!(await Allocation.getByName(`droidpd:${user.address}`));

      // Early Discord member allocation information
      user.earlyDiscordMemberAlloc = user.isEarlyDiscordMember ? this.cfgSrv.get('app.discord.earlyMemberAlloc') : '0';
      user.earlyDiscordMemberClaimed = !!(await Allocation.getByName(`early_member:${user.address}`));

      if (network) user.isDelegate = !!(await MarketManagerDelegate.findByNetworkAndAddress(network, user.address));

    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * Register a device
   * @param user The user object
   * @param token The device token (if not provided, a new one will be generated)
   * @returns The device token
   */
  async registerDevice(user: User, token = '') {
    if (!token) token = randStr(32);

    if (!user.deviceTokenEmail) {
      await this.chatNotifSrv.registerInstallation(user.id, 'email', token);
      await User.updateById(user.id, { deviceTokenEmail: token }, this.cacheSrv.cacheUser.bind(this.cacheSrv));
      user.deviceTokenEmail = token;
    }

    return token;
  }

  /**
   * Unregister a device
   * @param user The user object
   * @param deviceType The device type
   * @returns True if success
   */
  async unregisterDevice(user: User, deviceType: DeviceType) {
    if (!user.deviceTokenEmail) return true;
    await this.chatNotifSrv.unregisterInstallation(user.id);

    if (deviceType === 'email') {
      await User.updateById(user.id, { deviceTokenEmail: null }, this.cacheSrv.cacheUser.bind(this.cacheSrv));
    } else {
      throw new Error(`Unknown device type ${deviceType}`);
    }

    return true;
  }

  /**
   * Enable referrer state for a user
   * @param isNewUser Whether the user is new
   * @param referrerRefCode The referrer code
   * @param user The user object
   */
  async enableReferrerOps(isNewUser: boolean, referrerRefCode: string, user: User) {
    return transaction(User, async (User) => {
      if (user.refCode) return false;

      // Generate a new unique referrer code
      let newRefCode = '';
      while (true) {
        newRefCode = randStr(5).toLowerCase();
        const isRefCodeExists = await User.getByRefCode(newRefCode);
        if (!isRefCodeExists) break;
      }

      const referrer = referrerRefCode ? await User.getByRefCode(referrerRefCode) : undefined;
      const upd = await User.updateById(
        user.id,
        {
          refCode: newRefCode,
          referrer: isNewUser && referrer ? referrer.address : null,
        },
        this.cacheSrv.cacheUser.bind(this.cacheSrv),
      );

      user.refCode = upd.refCode;
      user.referrer = upd.referrer;

      await this.jntLinkSrv.createReferralLink(user.refCode).catch((e) => {
        this.logger.error(`enableReferrer: failed to create joint link`, e);
        throw e;
      });

      // Grant enlisting TAPs to the referred user
      if (isNewUser && referrer) {
        await this.tapSrv.createTap({
          userId: user.id,
          bonus: true,
          bonusName: 'referee_bonus',
          bonusValue: RefereeBonus.toString(),
        });
      }

      return true;
    });
  }
}
