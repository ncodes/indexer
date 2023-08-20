import { Injectable } from '@nestjs/common';
import Swap from '../../models/swap';
import User from '../../models/user';
import BadgeGrant from '../../models/badge_grant';
import { isEqualStr } from '../../common/common';

@Injectable()
export class UserService {
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
}
