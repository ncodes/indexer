import { Injectable } from '@nestjs/common';
import { build400, build401, ErrorTypes, throw404 } from '../../common/responses/responses';
import { isHexadecimal } from 'class-validator';
import User from '../../models/user';
import Message, { isAcceptOrRejectPaymentMethodType, MessageType } from '../../models/message';
import Swap from '../../models/swap';

@Injectable()
export class MessagesService {
  constructor() {}

  /**
   * Validate a list of encrypted messages
   * @param messages The list of messages
   */
  validate(messages: EncryptedMessage[]) {
    for (const msg of messages) {
      const i = messages.indexOf(msg);
      if (!msg.message)
        return build400(`message is required`, ErrorTypes.InvalidRequest, `[${i}].message`);
      if (!isHexadecimal(msg.message))
        return build400(`message encoding is unknown`, ErrorTypes.InvalidRequest, `[${i}].message`);
      if (!msg.recipient)
        return build400(
          `recipient's public key is required`,
          ErrorTypes.InvalidRequest,
          `[${i}].recipient`,
        );
      if (!isHexadecimal(msg.recipient))
        return build400(
          `recipient encoding is unknown`,
          ErrorTypes.InvalidRequest,
          `[${i}].recipient`,
        );
    }
    return true;
  }

  /**
   * Get the user ID of the message recipients
   * @param messages The list of encrypted messages
   */
  async getRecipients(messages: EncryptedMessage[]): Promise<string[]> {
    const recipients = [];
    let i = 0;
    for (const msg of messages) {
      const user = await User.getByMsgPubKey(msg.recipient);
      if (!user)
        throw404(`recipient public key is unknown`, ErrorTypes.InvalidRequest, `[${i}].message`);
      recipients.push(user.id);
      i++;
    }
    return Promise.resolve(recipients);
  }

  /**
   * Validate payment message =
   * @param type The type of message
   * @param swap The swap object
   * @param userAddress The requesting user
   * @returns HTTPException on error
   */
  async validatePaymentMessage(type: MessageType, swap: Swap, userAddress: string) {
    const ackMsg = await Message.getBySwapIdAndType(swap.id, MessageType.PaymentMethodAck);
    if (ackMsg) return Promise.reject(build400('payment method already acknowledged'));
    if (type === MessageType.PaymentMethodPropose) {
      const onChainParty = await swap.getOnChainParty();
      if (onChainParty.toLowerCase() !== userAddress.toLowerCase())
        return Promise.reject(build401(`not authorize to create ${type} message`, ErrorTypes.Perm));
    }
    if (isAcceptOrRejectPaymentMethodType(type)) {
      const offChainParty = await swap.getOffChainParty();
      if (offChainParty.toLowerCase() !== userAddress.toLowerCase()) {
        return Promise.reject(build401(`not authorize to create ${type} message`, ErrorTypes.Perm));
      }
    }
    if (type === MessageType.PaymentMethodAck) {
      const onChainParty = await swap.getOnChainParty();
      if (onChainParty.toLowerCase() !== userAddress.toLowerCase())
        return Promise.reject(build401(`not authorize to create ${type} message`, ErrorTypes.Perm));
    }
    return Promise.resolve();
  }
}
