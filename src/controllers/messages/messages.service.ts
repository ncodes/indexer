import { Injectable } from '@nestjs/common';
import { build400, ErrorTypes, throw404 } from '../../common/responses/responses';
import { isHexadecimal } from 'class-validator';
import User from '../../models/user';

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
}
