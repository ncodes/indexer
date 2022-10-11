import { Injectable } from '@nestjs/common';
import Swap from '../../models/swap';
import Dispute from '../../models/dispute';
import Draft from '../../models/draft';
import User from '../../models/user';
import * as _ from 'lodash';

@Injectable()
export default class SwapsService {
  /**
   * Get a list of user IDs allowed to create messages for a given swap.
   * Only provider, taker and current dispute draftees are allowed.
   * @param swap The swap object
   * @param addAppealedDisputeDraftees If true, appealed dispute draftees are added as participants.
   */
  async getParticipants(swap: Swap, addAppealedDisputeDraftees = false): Promise<string[]> {
    const { provider, taker, network, marketId, orderId } = swap;
    const participants = [provider, taker];
    const dispute = await Dispute.getRecentOfOrder(network, marketId, orderId);
    if (dispute) {
      const draftees = await Draft.getAll(network, marketId, orderId, dispute.disputeId);
      draftees.forEach((draftee) => {
        participants.push(draftee.owner);
      });

      if (addAppealedDisputeDraftees && dispute.disputeId > 0) {
        for (let i = 0; i < dispute.disputeId; i++) {
          const draftees = await Draft.getAll(network, marketId, orderId, i);
          draftees.forEach((draftee) => {
            participants.push(draftee.owner);
          });
        }
      }
    }

    const participantsId = [];
    for (const participant of participants) {
      const user = await User.getByAddress(participant);
      if (user) participantsId.push(user.id);
    }
    return Promise.resolve(_.uniq(participantsId));
  }

  /**
   * Check whether a user ID is a swap participant
   * @param swap The swap object
   * @param userId The user ID
   * @param addAppealedDisputeDraftees If true, appealed dispute draftees are added as participants.
   */
  async isSwapParticipant(swap: Swap, userId: string, addAppealedDisputeDraftees = true) {
    const participants = await this.getParticipants(swap, addAppealedDisputeDraftees);
    return Promise.resolve(participants.includes(userId));
  }
}
