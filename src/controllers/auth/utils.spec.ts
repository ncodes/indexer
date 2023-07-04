import { ethers } from 'ethers';
import * as moment from 'moment';
import { makeMsg } from './auth.controller.spec';
import { parseWalletSignature } from './utils';

describe('Utils', () => {
  describe('.parseSignature', () => {
    it('should return correct data on successful parsing', async () => {
      const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
      const wallet = new ethers.Wallet(privateKey);
      const msg = Buffer.from(
        makeMsg('0x14791697260E4c9A71f18484C9f997B308e59325', 'person@gmail.com', moment().toISOString()),
      );

      const sig = await wallet.signMessage(msg.toString());
      const sigInfo = parseWalletSignature(msg.toString('hex'), sig);
      expect(sigInfo.address).toEqual('0x14791697260E4c9A71f18484C9f997B308e59325'.toLowerCase());
      expect(sigInfo.email).toEqual('person@gmail.com');
    });

    it('should return correct data when some of ignoreEmail = true', async () => {
      const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
      const wallet = new ethers.Wallet(privateKey);
      const msg = Buffer.from(
        makeMsg('0x14791697260E4c9A71f18484C9f997B308e59325', 'person@gmail.com', moment().toISOString()),
      );

      const sig = await wallet.signMessage(msg.toString());
      const sigInfo = parseWalletSignature(msg.toString('hex'), sig, true);
      expect(sigInfo.address).toEqual('0x14791697260E4c9A71f18484C9f997B308e59325'.toLowerCase());
      expect(sigInfo.email).toBeUndefined();
    });

    it('should return error when message is malformed', async () => {
      const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
      const wallet = new ethers.Wallet(privateKey);
      const msg = Buffer.from(`invalid`);
      const sig = await wallet.signMessage(msg.toString());
      expect(() => {
        parseWalletSignature(msg.toString('hex'), sig, true);
      }).toThrowError('malformed message');
    });

    it('should return error when YAML part is malformed', async () => {
      const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
      const wallet = new ethers.Wallet(privateKey);
      const msg = Buffer.from(`invalid--**invalid`);
      const sig = await wallet.signMessage(msg.toString());
      expect(() => {
        parseWalletSignature(msg.toString('hex'), sig, true);
      }).toThrowError('malformed message');
    });

    it('should return error when message does not contain an address', async () => {
      const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
      const wallet = new ethers.Wallet(privateKey);
      const msg = Buffer.from(`invalid--invalid`);
      const sig = await wallet.signMessage(msg.toString());
      expect(() => {
        parseWalletSignature(msg.toString('hex'), sig, true);
      }).toThrowError('address mismatch');
    });

    it('should return error when contained address does not match recovered' + ' address', async () => {
      const privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
      const wallet = new ethers.Wallet(privateKey);
      const msg = Buffer.from(`something--
Address: "0x123"`);
      const sig = await wallet.signMessage(msg.toString());
      expect(() => {
        parseWalletSignature(msg.toString('hex'), sig, true);
      }).toThrowError('address mismatch');
    });
  });
});
