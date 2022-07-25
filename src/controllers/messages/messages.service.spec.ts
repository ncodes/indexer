import { Test, TestingModule } from '@nestjs/testing';
import { DBService } from '../../db/DBService';
import { MessagesService } from './messages.service';
import { HttpException } from '@nestjs/common';
import User from '../../models/user';

describe('MessagesService', () => {
  let module: TestingModule;
  let service: MessagesService;
  const db = DBService.getForTest();
  const net = 'ethereum';

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
});
