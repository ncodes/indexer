import { Injectable } from '@nestjs/common';
import Swap from '../../models/swap';
import Dispute from '../../models/dispute';
import Draft from '../../models/draft';
import User from '../../models/user';
import * as _ from 'lodash';

@Injectable()
export default class SwapService {
  /**
   * Get a list of user IDs allowed to create messages for a given swap.
   * Only provider, taker and current dispute draftees are allowed.
   * @param swap The swap object
   * @param includeAllDisputes If true, re-disputes draftees are also added as participants.
   */
  async getParticipants(swap: Swap, includeAllDisputes = false): Promise<string[]> {
    const { provider, taker, network, marketAddress, orderId } = swap;
    const participants = [provider, taker];

    // Get current dispute draftees
    const dispute = await Dispute.getRecentOfOrder(network, marketAddress, orderId);
    if (dispute) {
      const draftees = await Draft.getAll(network, marketAddress, orderId, dispute.disputeId);
      draftees.forEach((draftee) => participants.push(draftee.owner));

      if (includeAllDisputes && dispute.disputeId > 0) {
        for (let i = 0; i < dispute.disputeId; i++) {
          const draftees = await Draft.getAll(network, marketAddress, orderId, i);
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
}
