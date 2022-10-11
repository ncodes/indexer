import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DBService } from '../../db/DBService';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import User from '../../models/user';
import { Roles } from '../../common/roles';
import * as request from 'supertest';
import { makeSession } from '../auth/utils';
import * as cryptoRandomString from 'crypto-random-string';
import { WebSocketService } from './webSocketService';
import { MessagesService } from './messages.service';
import SwapsService from '../swaps/swaps.service';
import { MessagesController } from './messages.controller';
import Swap from '../../models/swap';
import Message, { MessageType } from '../../models/message';
import MessageReadStatus from '../../models/message_read_status';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

describe('MessagesController', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let cfgObj = {};

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
    await app.close();
  });

  beforeEach(async () => {
    await db.truncateTables();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCfgGet.mockReset();

    cfgObj = { 'auth.jwtSecret': 'secret_secret' };
    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [MessagesController],
      providers: [ConfigService, MessagesService, WebSocketService, SwapsService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .compile();
    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  let u: User;
  let token: string;
  beforeEach(async () => {
    u = await User.create({ role: Roles.User });
    token = await makeSession(
      u,
      cryptoRandomString({ length: 10 }),
      '5',
      mockCfgGet('auth.jwtSecret'),
    );
  });

  describe('.create', () => {
    it('should return 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .post(`/v1/messages`)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 400 when type was not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/messages`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(400)
        .expect({
          error: {
            message: 'type is required',
            param: 'type',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when type is invalid', async () => {
      await request(app.getHttpServer())
        .post(`/v1/messages`)
        .set('Authorization', 'bearer ' + token)
        .send({ type: 'invalid' })
        .expect(400)
        .expect({
          error: {
            message: 'invalid type',
            param: 'type',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when order ID was not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/messages`)
        .set('Authorization', 'bearer ' + token)
        .send({ type: MessageType.Chat })
        .expect(400)
        .expect({
          error: {
            message: 'order ID is required',
            param: 'orderId',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when order id is not a number', async () => {
      await request(app.getHttpServer())
        .post(`/v1/messages`)
        .set('Authorization', 'bearer ' + token)
        .send({ type: MessageType.Chat, orderId: 'a' })
        .expect(400)
        .expect({
          error: {
            message: 'must be a number',
            param: 'orderId',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when no message was provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/messages`)
        .set('Authorization', 'bearer ' + token)
        .send({ type: MessageType.Chat, orderId: 1 })
        .expect(400)
        .expect({
          error: {
            message: 'at least one message is required',
            param: 'messages',
            type: 'invalid_request_error',
          },
        });
    });

    it(`should return 400 when a message's 'message' property is unset`, async () => {
      await request(app.getHttpServer())
        .post(`/v1/messages`)
        .set('Authorization', 'bearer ' + token)
        .send({ type: MessageType.Chat, orderId: 1, messages: [{}] })
        .expect(400)
        .expect({
          error: {
            param: '[0].message',
            type: 'invalid_request_error',
            message: 'message is required',
          },
        });
    });

    it(`should return 400 when a message's 'recipient' property is unset`, async () => {
      await request(app.getHttpServer())
        .post(`/v1/messages`)
        .set('Authorization', 'bearer ' + token)
        .send({ type: MessageType.Chat, orderId: 1, messages: [{ message: 'abc' }] })
        .expect(400)
        .expect({
          error: {
            param: '[0].recipient',
            type: 'invalid_request_error',
            message: `recipient's public key is required`,
          },
        });
    });

    it(`should return 404 when swap was not found`, async () => {
      await request(app.getHttpServer())
        .post(`/v1/messages`)
        .set('Authorization', 'bearer ' + token)
        .send({
          type: MessageType.Chat,
          orderId: 1,
          messages: [{ message: 'abc', recipient: 'abc' }],
        })
        .expect(404)
        .expect({
          error: {
            param: 'orderId',
            type: 'invalid_request_error',
            message: 'swap order not found',
          },
        });
    });

    it(`should return 400 when swap was an instant swap`, async () => {
      const swap = await Swap.create({ orderId: 1, instant: true });
      await request(app.getHttpServer())
        .post(`/v1/messages`)
        .set('Authorization', 'bearer ' + token)
        .send({
          type: MessageType.Chat,
          orderId: swap.orderId,
          messages: [{ message: 'abc', recipient: 'abc' }],
        })
        .expect(400)
        .expect({
          error: {
            param: 'orderId',
            type: 'invalid_request_error',
            message: 'instant swap not supported',
          },
        });
    });

    it(`should return 401 when authenticated user is not a participant in the swap`, async () => {
      await User.updateById(u.id, { address: '0xUnknown' });
      await User.create({ address: '0xTaker', messengerPublicKey: 'abc' });
      const swap = await Swap.create({
        orderId: 1,
        provider: '0xProvider',
        taker: '0xTaker',
      });
      await request(app.getHttpServer())
        .post(`/v1/messages`)
        .set('Authorization', 'bearer ' + token)
        .send({
          type: MessageType.Chat,
          orderId: swap.orderId,
          messages: [{ message: 'abc', recipient: 'abc' }],
        })
        .expect(401)
        .expect({
          error: {
            param: 'messages',
            type: 'authentication_error',
            message: `you are not or no longer a participant`,
          },
        });
    });

    it(`should return 401 when a message recipient is not a participant in the swap`, async () => {
      await User.updateById(u.id, { address: '0xProvider' });
      const recipient = await User.create({
        address: '0xRecipient',
        messengerPublicKey: 'abc',
      });
      const swap = await Swap.create({
        orderId: 1,
        provider: '0xProvider',
        taker: '0xTaker',
      });
      await request(app.getHttpServer())
        .post(`/v1/messages`)
        .set('Authorization', 'bearer ' + token)
        .send({
          type: MessageType.Chat,
          orderId: swap.orderId,
          messages: [{ message: 'abc', recipient: 'abc' }],
        })
        .expect(401)
        .expect({
          error: {
            param: 'messages',
            type: 'authentication_error',
            message: `recipient[${recipient.id}] is not or no longer a participant`,
          },
        });
    });

    it(`should return 201 on success`, async () => {
      await User.updateById(u.id, { address: '0xProvider' });
      const recipient = await User.create({
        address: '0xTaker',
        messengerPublicKey: 'abc',
      });
      const swap = await Swap.create({
        orderId: 1,
        provider: '0xProvider',
        taker: '0xTaker',
      });
      const mockWSEmit = jest.spyOn(app.get(WebSocketService), 'emit');
      let msgId;
      await request(app.getHttpServer())
        .post(`/v1/messages`)
        .set('Authorization', 'bearer ' + token)
        .send({
          type: MessageType.Chat,
          orderId: swap.orderId,
          messages: [{ message: 'abc', recipient: 'abc' }],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('object');
          expect(res.body.data.object).toEqual('msg');
          expect(res.body.data.messages).toEqual(['abc']);
          expect(res.body.data.recipientsId).toEqual([recipient.id]);
          expect(res.body.data.recipientsMsgPubKey).toEqual([recipient.messengerPublicKey]);
          msgId = res.body.data.id;
        });
      expect(mockWSEmit).toBeCalledWith(`msg:new:${swap.id}`, msgId);

      const msgReadStatus = await MessageReadStatus.find({
        msgId,
        userId: recipient.id,
      });
      expect(msgReadStatus).toBeDefined();
      expect(msgReadStatus.read).toBeFalsy();
    });
  });

  describe('.get', () => {
    it('should return 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .get(`/v1/messages/abc`)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 404 when message was not found', async () => {
      await request(app.getHttpServer())
        .get(`/v1/messages/abc`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(404)
        .expect({
          error: {
            param: 'id',
            type: 'invalid_request_error',
            message: 'message not found',
          },
        });
    });

    it('should return 404 when message swap order was not found', async () => {
      const msg = await Message.create({ type: MessageType.Chat, swapId: 'swap_abc' });
      await request(app.getHttpServer())
        .get(`/v1/messages/${msg.id}`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(404)
        .expect({
          error: {
            type: 'invalid_request_error',
            message: 'swap order not found',
          },
        });
    });

    it('should return 401 when authenticated user is not a swap participant', async () => {
      const swap = await Swap.create({});
      const msg = await Message.create({ type: MessageType.Chat, swapId: swap.id });
      await request(app.getHttpServer())
        .get(`/v1/messages/${msg.id}`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'not permitted to perform this action',
          },
        });
    });

    it('should return 200 and message on success', async () => {
      await User.updateById(u.id, { address: '0xProvider' });
      const swap = await Swap.create({ provider: '0xProvider' });
      const msg = await Message.create({ type: MessageType.Chat, swapId: swap.id });
      await request(app.getHttpServer())
        .get(`/v1/messages/${msg.id}`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(200)
        .expect((res) => {
          expect(res.body.data.object).toEqual('msg');
          expect(res.body.data.id).toEqual(msg.id);
        });
    });
  });

  describe('.list', () => {
    it('should return 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .get(`/v1/messages`)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 400 when order ID was not provided', async () => {
      await request(app.getHttpServer())
        .get(`/v1/messages`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(400)
        .expect({
          error: {
            message: 'order ID is required',
            param: 'orderId',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when order Id is not a number', async () => {
      await request(app.getHttpServer())
        .get(`/v1/messages`)
        .set('Authorization', 'bearer ' + token)
        .query({ type: MessageType.Chat, orderId: 'a' })
        .expect(400)
        .expect({
          error: {
            message: 'must be a number',
            param: 'orderId',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 404 when swap was not found', async () => {
      await request(app.getHttpServer())
        .get(`/v1/messages`)
        .set('Authorization', 'bearer ' + token)
        .query({ type: MessageType.Chat, orderId: 1 })
        .expect(404)
        .expect({
          error: {
            param: 'orderId',
            type: 'invalid_request_error',
            message: 'swap order not found',
          },
        });
    });

    it('should return 401 when authenticated user is not a swap participant', async () => {
      const swap = await Swap.create({ orderId: 1, provider: '0xProvider' });
      await request(app.getHttpServer())
        .get(`/v1/messages`)
        .set('Authorization', 'bearer ' + token)
        .query({ type: MessageType.Chat, orderId: swap.orderId })
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'not permitted to perform this action',
          },
        });
    });

    it('should return 200 and correctly ordered messages', async () => {
      await User.updateById(u.id, { address: '0xProvider' });
      const swap = await Swap.create({ orderId: 1, provider: '0xProvider' });
      const msg1 = await Message.create({ type: MessageType.Chat, swapId: swap.id });
      const msg2 = await Message.create({ swapId: swap.id });
      await request(app.getHttpServer())
        .get(`/v1/messages`)
        .set('Authorization', 'bearer ' + token)
        .query({ orderId: swap.orderId })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(2);
          expect(res.body.data[0].id).toEqual(msg1.id);
          expect(res.body.data[1].id).toEqual(msg2.id);
        });
    });

    describe('when limit is set', () => {
      it('should return 200 and correctly ordered messages', async () => {
        await User.updateById(u.id, { address: '0xProvider' });
        const swap = await Swap.create({ orderId: 1, provider: '0xProvider' });
        await Message.create({ swapId: swap.id });
        const msg2 = await Message.create({ swapId: swap.id });
        const msg3 = await Message.create({ swapId: swap.id });
        await request(app.getHttpServer())
          .get(`/v1/messages`)
          .set('Authorization', 'bearer ' + token)
          .query({ orderId: swap.orderId, limit: 2 })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].id).toEqual(msg2.id);
            expect(res.body.data[1].id).toEqual(msg3.id);
          });
      });
    });

    describe('when before is set', () => {
      it('should return 200 and correctly ordered messages (when before=3)', async () => {
        await User.updateById(u.id, { address: '0xProvider' });
        const swap = await Swap.create({ orderId: 1, provider: '0xProvider' });
        const msg1 = await Message.create({ swapId: swap.id });
        const msg2 = await Message.create({ swapId: swap.id });
        await Message.create({ swapId: swap.id });
        await request(app.getHttpServer())
          .get(`/v1/messages`)
          .set('Authorization', 'bearer ' + token)
          .query({ orderId: swap.orderId, before: 3 })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].id).toEqual(msg1.id);
            expect(res.body.data[1].id).toEqual(msg2.id);
          });
      });

      it('should return 200 and correctly ordered messages (when before=2)', async () => {
        await User.updateById(u.id, { address: '0xProvider' });
        const swap = await Swap.create({ orderId: 1, provider: '0xProvider' });
        const msg1 = await Message.create({ swapId: swap.id });
        await Message.create({ swapId: swap.id });
        await Message.create({ swapId: swap.id });
        await request(app.getHttpServer())
          .get(`/v1/messages`)
          .set('Authorization', 'bearer ' + token)
          .query({ orderId: swap.orderId, before: 2 })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(msg1.id);
          });
      });

      it('should return 200 and correctly ordered messages (when before=3, limit=1)', async () => {
        await User.updateById(u.id, { address: '0xProvider' });
        const swap = await Swap.create({ orderId: 1, provider: '0xProvider' });
        await Message.create({ swapId: swap.id });
        const msg2 = await Message.create({ swapId: swap.id });
        await Message.create({ swapId: swap.id });
        await request(app.getHttpServer())
          .get(`/v1/messages`)
          .set('Authorization', 'bearer ' + token)
          .query({ orderId: swap.orderId, before: 3, limit: 1 })
          .expect(200)
          .expect((res) => {
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toEqual(msg2.id);
          });
      });
    });
  });

  describe('.markAsRead', () => {
    it('should return 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .put(`/v1/messages/abc/mark-read`)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 404 when message was not found', async () => {
      await request(app.getHttpServer())
        .put(`/v1/messages/abc/mark-read`)
        .set('Authorization', 'bearer ' + token)
        .expect(404)
        .expect({
          error: {
            param: 'msgId',
            type: 'invalid_request_error',
            message: 'message not found',
          },
        });
    });

    it('should return 401 when authenticated user is not one of the message recipients', async () => {
      const msg = await Message.create({});
      await request(app.getHttpServer())
        .put(`/v1/messages/${msg.id}/mark-read`)
        .set('Authorization', 'bearer ' + token)
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'not permitted to perform action',
          },
        });
    });

    it('should return 200 and update read status correctly', async () => {
      const msg = await Message.create({
        recipientsId: [null, u.id],
      });
      let msgReadStatus = await MessageReadStatus.create({
        userId: u.id,
        msgId: msg.id,
        read: false,
      });
      await request(app.getHttpServer())
        .put(`/v1/messages/${msg.id}/mark-read`)
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect({ data: { ok: true } });

      msgReadStatus = await MessageReadStatus.getById(msgReadStatus.id);
      expect(msgReadStatus.read).toBeTruthy();
    });
  });

  describe('.countUnread', () => {
    it('should return 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .get(`/v1/messages/count-unread`)
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 400 when swap ID was not provided', async () => {
      await MessageReadStatus.create({ userId: u.id });
      await MessageReadStatus.create({ userId: u.id });
      await request(app.getHttpServer())
        .get(`/v1/messages/count-unread`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(200)
        .expect({
          data: { count: '2' },
        });
    });
  });

  describe('.getPaymentMethodMessages', () => {
    it('should return 401 when not authorized', async () => {
      await request(app.getHttpServer())
        .get(`/v1/messages/abc/pm-messages`)
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 400 when order ID is not a number', async () => {
      await request(app.getHttpServer())
        .get(`/v1/messages/abc/pm-messages`)
        .set('Authorization', 'bearer ' + token)
        .expect(400)
        .expect({
          error: {
            message: 'must be a number',
            param: 'orderId',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 404 when order does not exist', async () => {
      await request(app.getHttpServer())
        .get(`/v1/messages/1/pm-messages`)
        .set('Authorization', 'bearer ' + token)
        .expect(404)
        .expect({
          error: {
            param: 'swapId',
            type: 'invalid_request_error',
            message: 'swap order not found',
          },
        });
    });

    it('should return 200 and all payment method messages only', async () => {
      await User.updateById(u.id, { address: '0xProvider' });
      const swap = await Swap.create({ orderId: 1, provider: '0xProvider' });
      await Message.create({ type: MessageType.Chat, swapId: swap.id });
      await Message.create({ type: MessageType.PaymentMethodAccept, swapId: swap.id });
      await Message.create({ type: MessageType.PaymentMethodPropose, swapId: swap.id });
      await Message.create({ type: MessageType.PaymentMethodReject, swapId: swap.id });
      await Message.create({ type: MessageType.PaymentMethodAck, swapId: swap.id });
      await request(app.getHttpServer())
        .get(`/v1/messages/${swap.orderId}/pm-messages`)
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(4);
          const chat = res.body.data.find((m) => m.type === MessageType.Chat);
          expect(chat).toBeUndefined();
        });
    });
  });
});
