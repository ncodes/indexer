import { ethers } from 'ethers';
import * as moment from 'moment';
import { makeMsg } from './auth.controller.spec';
import { parseSignature } from './utils';

describe('Utils', () => {
  describe('.parseSignature', () => {
    it('should return correct data on successful parsing', async () => {
      const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
      const wallet = new ethers.Wallet(privateKey);
      const msg = Buffer.from(
        makeMsg(
          '0x14791697260E4c9A71f18484C9f997B308e59325',
          'person@gmail.com',
          'public_key',
          moment().toISOString(),
        ),
      );

      const sig = await wallet.signMessage(msg.toString());
      const sigInfo = parseSignature(msg.toString('hex'), sig);
      expect(sigInfo.address).toEqual('0x14791697260E4c9A71f18484C9f997B308e59325'.toLowerCase());
      expect(sigInfo.email).toEqual('person@gmail.com');
      expect(sigInfo.messengerPublicKey).toEqual('public_key');
    });

    it(
      'should return correct data when some of ignoreEmail or' + ' ignoreMsgPubKey' + ' = true',
      async () => {
        const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
        const wallet = new ethers.Wallet(privateKey);
        const msg = Buffer.from(
          makeMsg(
            '0x14791697260E4c9A71f18484C9f997B308e59325',
            'person@gmail.com',
            'public_key',
            moment().toISOString(),
          ),
        );

        const sig = await wallet.signMessage(msg.toString());
        const sigInfo = parseSignature(msg.toString('hex'), sig, true, true);
        expect(sigInfo.address).toEqual('0x14791697260E4c9A71f18484C9f997B308e59325'.toLowerCase());
        expect(sigInfo.email).toBeUndefined();
        expect(sigInfo.messengerPublicKey).toBeUndefined();
      },
    );

    it('should return error when message is malformed', async () => {
      const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
      const wallet = new ethers.Wallet(privateKey);
      const msg = Buffer.from(`invalid`);
      const sig = await wallet.signMessage(msg.toString());
      expect(() => {
        parseSignature(msg.toString('hex'), sig, true, true);
      }).toThrowError('malformed message');
    });

    it('should return error when YAML part is malformed', async () => {
      const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
      const wallet = new ethers.Wallet(privateKey);
      const msg = Buffer.from(`invalid--**invalid`);
      const sig = await wallet.signMessage(msg.toString());
      expect(() => {
        parseSignature(msg.toString('hex'), sig, true, true);
      }).toThrowError('malformed message');
    });

    it('should return error when message does not contain an address', async () => {
      const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
      const wallet = new ethers.Wallet(privateKey);
      const msg = Buffer.from(`invalid--invalid`);
      const sig = await wallet.signMessage(msg.toString());
      expect(() => {
        parseSignature(msg.toString('hex'), sig, true, true);
      }).toThrowError('address mismatch');
    });

    it(
      'should return error when contained address does not match recovered' + ' address',
      async () => {
        const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
        const wallet = new ethers.Wallet(privateKey);
        const msg = Buffer.from(`something--
Address: "0x123"`);
        const sig = await wallet.signMessage(msg.toString());
        expect(() => {
          parseSignature(msg.toString('hex'), sig, true, true);
        }).toThrowError('address mismatch');
      },
    );
  });
});
