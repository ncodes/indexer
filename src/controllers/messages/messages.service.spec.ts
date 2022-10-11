import { Test, TestingModule } from '@nestjs/testing';
import { DBService } from '../../db/DBService';
import { MessagesService } from './messages.service';
import { HttpException } from '@nestjs/common';
import User from '../../models/user';
import Message, { MessageType } from '../../models/message';
import Swap from '../../models/swap';
import Market from '../../models/market';
import { buildHttpException } from '../../common/responses/responses';

describe('MessagesService', () => {
  let module: TestingModule;
  let service: MessagesService;
  const db = DBService.getForTest();

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.truncateTables();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      providers: [MessagesService],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  describe('.validate', () => {
    it('should return error when an EncryptedMessage is missing a `message` value', async () => {
      const messages: EncryptedMessage[] = [
        {
          message: undefined,
          recipient: undefined,
        },
      ];
      const r = service.validate(messages);
      expect(r).toBeInstanceOf(HttpException);
      expect((r as HttpException).getResponse()).toEqual({
        error: {
          param: '[0].message',
          type: 'invalid_request_error',
          message: 'message is required',
        },
      });
      expect((r as HttpException).getStatus()).toEqual(400);
    });

    it('should return error when an EncryptedMessage.`message` is not hexadecimal', async () => {
      const messages: EncryptedMessage[] = [
        {
          message: '&%',
          recipient: undefined,
        },
      ];
      const r = service.validate(messages);
      expect(r).toBeInstanceOf(HttpException);
      expect((r as HttpException).getResponse()).toEqual({
        error: {
          param: '[0].message',
          type: 'invalid_request_error',
          message: 'message encoding is unknown',
        },
      });
      expect((r as HttpException).getStatus()).toEqual(400);
    });

    it('should return error when an EncryptedMessage is missing a `recipient` value', async () => {
      const messages: EncryptedMessage[] = [
        {
          message: 'abc',
          recipient: undefined,
        },
      ];
      const r = service.validate(messages);
      expect(r).toBeInstanceOf(HttpException);
      expect((r as HttpException).getResponse()).toEqual({
        error: {
          param: '[0].recipient',
          type: 'invalid_request_error',
          message: `recipient's public key is required`,
        },
      });
      expect((r as HttpException).getStatus()).toEqual(400);
    });

    it('should return error when an EncryptedMessage.`recipient` is not hexadecimal', async () => {
      const messages: EncryptedMessage[] = [{ message: 'abc', recipient: '&' }];
      const r = service.validate(messages);
      expect(r).toBeInstanceOf(HttpException);
      expect((r as HttpException).getResponse()).toEqual({
        error: {
          param: '[0].recipient',
          type: 'invalid_request_error',
          message: 'recipient encoding is unknown',
        },
      });
      expect((r as HttpException).getStatus()).toEqual(400);
    });

    it('should return true when an EncryptedMessage is valid', async () => {
      const messages: EncryptedMessage[] = [
        {
          message: 'abc',
          recipient: 'abc',
        },
      ];
      const r = service.validate(messages);
      expect(r).toBeTruthy();
    });
  });

  describe('.getRecipients', () => {
    it('should return correct user IDs', async () => {
      const user1 = await User.create({ messengerPublicKey: 'pub1' });
      const user2 = await User.create({ messengerPublicKey: 'pub2' });
      const messages: EncryptedMessage[] = [
        { message: 'abc', recipient: 'pub1' },
        { message: 'xyz', recipient: 'pub2' },
      ];
      const recipients = await service.getRecipients(messages);
      expect(recipients).toHaveLength(2);
      expect(recipients).toEqual([user1.id, user2.id]);
    });
  });

  describe('.validatePaymentMessage', () => {
    it('should throw when swap already has an acknowledge message', async () => {
      const market = await Market.create({
        marketId: 'mid',
        isBaseLocal: false,
        isQuoteLocal: true,
      });
      const swap = await Swap.create({
        marketId: market.marketId,
        provider: '0xOnchainUser',
        taker: '0xOffchainUser',
      });
      await Message.create({ swapId: swap.id, type: MessageType.PaymentMethodAck });
      await expect(
        service.validatePaymentMessage(MessageType.PaymentMethodPropose, swap, '0xUser'),
      ).rejects.toEqual(
        buildHttpException(
          {
            error: {
              param: undefined,
              type: 'invalid_request_error',
              message: 'payment method already acknowledged',
            },
          },
          401,
        ),
      );
    });

    describe('should only allow on-chain party propose payment method', function () {
      let market: Market;
      let swap: Swap;
      beforeEach(async () => {
        market = await Market.create({
          marketId: 'mid',
          isBaseLocal: false,
          isQuoteLocal: true,
        });
        swap = await Swap.create({
          marketId: market.marketId,
          provider: '0xOnchainUser',
          taker: '0xOffchainUser',
        });
      });

      it('should throw when user is not the on-chain party', async () => {
        await expect(
          service.validatePaymentMessage(MessageType.PaymentMethodPropose, swap, '0xOffchainUser'),
        ).rejects.toEqual(
          buildHttpException(
            {
              error: {
                param: undefined,
                type: 'permission_error',
                message: 'not authorize to create pm_propose message',
              },
            },
            401,
          ),
        );
      });

      it('should not throw when user is the on-chain party', async () => {
        await expect(
          service.validatePaymentMessage(MessageType.PaymentMethodPropose, swap, '0xOnchainUser'),
        ).resolves.toBeUndefined();
      });
    });

    describe('should only allow off-chain party accept payment method', function () {
      let market: Market;
      let swap: Swap;
      beforeEach(async () => {
        market = await Market.create({
          marketId: 'mid',
          isBaseLocal: false,
          isQuoteLocal: true,
        });
        swap = await Swap.create({
          marketId: market.marketId,
          provider: '0xOnchainUser',
          taker: '0xOffchainUser',
        });
      });

      it('should throw when user is not the off-chain party', async () => {
        await expect(
          service.validatePaymentMessage(MessageType.PaymentMethodAccept, swap, '0xOnchainUser'),
        ).rejects.toEqual(
          buildHttpException(
            {
              error: {
                param: '',
                type: 'permission_error',
                message: 'not authorize to create pm_accept message',
              },
            },
            401,
          ),
        );
      });

      it('should not throw when user is the off-chain party', async () => {
        await expect(
          service.validatePaymentMessage(MessageType.PaymentMethodAccept, swap, '0xOffchainUser'),
        ).resolves.toBeUndefined();
      });
    });

    describe('should only allow off-chain party reject payment method', function () {
      let market: Market;
      let swap: Swap;
      beforeEach(async () => {
        market = await Market.create({
          marketId: 'mid',
          isBaseLocal: false,
          isQuoteLocal: true,
        });
        swap = await Swap.create({
          marketId: market.marketId,
          provider: '0xOnchainUser',
          taker: '0xOffchainUser',
        });
      });

      it('should throw when user is not the off-chain party', async () => {
        await expect(
          service.validatePaymentMessage(MessageType.PaymentMethodReject, swap, '0xOnchainUser'),
        ).rejects.toEqual(
          buildHttpException(
            {
              error: {
                param: '',
                type: 'permission_error',
                message: 'not authorize to create pm_accept message',
              },
            },
            401,
          ),
        );
      });

      it('should not throw when user is the off-chain party', async () => {
        await expect(
          service.validatePaymentMessage(MessageType.PaymentMethodReject, swap, '0xOffchainUser'),
        ).resolves.toBeUndefined();
      });
    });

    describe('should only allow on-chain party acknowledge payment method', function () {
      let market: Market;
      let swap: Swap;
      beforeEach(async () => {
        market = await Market.create({
          marketId: 'mid',
          isBaseLocal: false,
          isQuoteLocal: true,
        });
        swap = await Swap.create({
          marketId: market.marketId,
          provider: '0xOnchainUser',
          taker: '0xOffchainUser',
        });
      });

      it('should throw when user is not the on-chain party', async () => {
        await expect(
          service.validatePaymentMessage(MessageType.PaymentMethodAck, swap, '0xOffchainUser'),
        ).rejects.toEqual(
          buildHttpException(
            {
              error: {
                param: undefined,
                type: 'permission_error',
                message: 'not authorize to create pm_propose message',
              },
            },
            401,
          ),
        );
      });

      it('should not throw when user is the on-chain party', async () => {
        await expect(
          service.validatePaymentMessage(MessageType.PaymentMethodAck, swap, '0xOnchainUser'),
        ).resolves.toBeUndefined();
      });
    });
  });
});
