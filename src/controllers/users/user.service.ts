import { Injectable } from '@nestjs/common';
import { isEqualStr, randStr } from '../../common/common';
import BadgeGrant from '../../models/badge_grant';
import Swap from '../../models/swap';
import User from '../../models/user';
import ConvosService from '../convos/convos.service';
import { DeviceType } from './dto';

@Injectable()
export class UserService {
  constructor(private chatNotifSrv: ConvosService) {}

  /**
   * Extend user with peripheral and derived data
   * @param user The user object
   * @param network The network name
   * @returns
   */
  async extendUser(user: User, network?: string) {
    try {
      const totalSwaps = await Swap.countByStatus(
        network,
        undefined,
        undefined,
        user.address,
        undefined,
        false,
        undefined,
      );
      user.totalSwaps = parseInt(totalSwaps);
      user.completionRate = await Swap.getCompletionRate(network, undefined, undefined, user.address);

      const badges = await BadgeGrant.search(network, undefined, undefined, user.address);
      user.badges = (badges as BadgeGrant[]).map((b) => {
        const arr = [b.badge];
        if (b.path) arr.push(b.path);
        return arr.join('/');
      });

      user.volume = await Swap.getVolume(network, undefined, undefined, undefined, user.address);
      user.volumeUsd = parseFloat(
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
      );

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
      await User.updateById(user.id, { deviceTokenEmail: token });
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
      await User.updateById(user.id, { deviceTokenEmail: null });
    } else {
      throw new Error(`Unknown device type ${deviceType}`);
    }

    return true;
  }

  /**
   * Enable referrer state for a user
   * @param isNewUser Whether the user is new
   * @param referrer The referrer address
   * @param user The user object
   */
  async enableReferrer(isNewUser: boolean, referrer: string, user: User) {
    if (user.refCode) return false;
    const upd = await User.updateById(user.id, {
      refCode: randStr(5).toLowerCase(),
      referrer: isNewUser ? referrer : undefined,
    });
    user.refCode = upd.refCode;
    user.referrer = upd.referrer;
    return true;
  }
}
