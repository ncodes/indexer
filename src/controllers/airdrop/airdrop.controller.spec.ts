import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as moment from 'moment';
import * as request from 'supertest';
import { randStr } from '../../common/common';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { Roles } from '../../common/roles';
import { DBService } from '../../db/db.service';
import Point, { PointAction } from '../../models/point';
import Quest from '../../models/quest';
import Swap from '../../models/swap';
import TwitterEngagement from '../../models/twitter_engagement';
import User from '../../models/user';
import DiscordService from '../../services/discord.service';
import { RedisService } from '../../services/redis/redis.service';
import { makeSession } from '../auth/utils';
import { TwitterService } from './../../services/twitter.service';
import { AirdropController } from './airdrop.controller';
import AirdropService from './airdrop.service';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

const DiscordServiceMock = jest.fn().mockImplementation(() => {
  return {};
});

const RedisServiceMock = jest.fn().mockImplementation(() => {
  return {};
});

describe('AirdropController', () => {
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

    cfgObj = {
      'auth.jwtSecret': 'secret_secret',
      'app.maxDailyQuestVerify': 3,
    };

    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [AirdropController],
      providers: [ConfigService, TwitterService, AirdropService, DiscordService, RedisService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(DiscordService)
      .useValue(new DiscordServiceMock())
      .overrideProvider(RedisService)
      .useValue(new RedisServiceMock())
      .compile();
    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  let u: User, u2: User, u3: User;
  let token: string, token2: string, token3: string;
  beforeEach(async () => {
    u = await User.create({ role: Roles.User, address: '0xAddress', twitterUserId: '1' });
    u2 = await User.create({ role: Roles.User, address: '0xAddress2_', twitterUserId: '2' });
    u3 = await User.create({ role: Roles.User, address: '0xAddress3', twitterUserId: '3' });
    token = await makeSession(u, randStr(), '5', mockCfgGet('auth.jwtSecret'));
    token2 = await makeSession(u2, randStr(), '5', mockCfgGet('auth.jwtSecret'));
    token3 = await makeSession(u3, randStr(), '5', mockCfgGet('auth.jwtSecret'));
  });

  describe('.createVerifyQuest', () => {
    it('should return 401 when no authorization', async () => {
      await request(app.getHttpServer())
        .post(`/v1/airdrop/request-verify/unknown`)
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 400 when vote was not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/airdrop/request-verify/unknown`)
        .set('Authorization', 'bearer ' + token)
        .expect(400)
        .expect({
          error: { type: 'invalid_request_error', message: 'Quest not found' },
        });
    });

    it('should return 400 when quest type is `tweet` but link was not provided', async () => {
      const quest = await Quest.create({ type: 'tweet' });
      await request(app.getHttpServer())
        .post(`/v1/airdrop/request-verify/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .expect(400)
        .expect({
          error: {
            message: 'tweet link is required',
            param: 'link',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when quest type is `quote` but link was not provided', async () => {
      const quest = await Quest.create({ type: 'quote' });
      await request(app.getHttpServer())
        .post(`/v1/airdrop/request-verify/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .expect(400)
        .expect({
          error: {
            message: 'tweet link is required',
            param: 'link',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when quest type is `reply` but link was not provided', async () => {
      const quest = await Quest.create({ type: 'reply' });
      await request(app.getHttpServer())
        .post(`/v1/airdrop/request-verify/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .expect(400)
        .expect({
          error: {
            message: 'tweet link is required',
            param: 'link',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when quest type is `tweet` but link url is not valid tweet link', async () => {
      const quest = await Quest.create({ type: 'tweet' });
      await request(app.getHttpServer())
        .post(`/v1/airdrop/request-verify/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .send({ link: 'https://txswitter.com/StarTrek/status1450144651940294656' })
        .expect(400)
        .expect({
          error: {
            message: 'invalid link provided',
            param: 'link',
            type: 'invalid_request_error',
          },
        });

      await request(app.getHttpServer())
        .post(`/v1/airdrop/request-verify/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .send({ link: 'https://twitter.com/StarTrek/status1450144651940294656' })
        .expect(400)
        .expect({
          error: {
            message: 'invalid link provided',
            param: 'link',
            type: 'invalid_request_error',
          },
        });

      await request(app.getHttpServer())
        .post(`/v1/airdrop/request-verify/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .send({ link: 'https://x.com/StarTrek/status/1450144651940294656' })
        .expect(201);
    });

    it('should return 400 when twitter was not linked', async () => {
      await User.updateById(u.id, { twitterUserId: null });
      const quest = await Quest.create({ type: 'tweet' });
      await request(app.getHttpServer())
        .post(`/v1/airdrop/request-verify/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .send({ link: 'https://twitter.com/StarTrek/status/1450144651940294656' })
        .expect(400)
        .expect({
          error: {
            type: 'invalid_request_error',
            message: 'Twitter not linked',
          },
        });
    });

    it('should return 400 when there is an existing verify request for the quest', async () => {
      const quest = await Quest.create({ type: 'tweet' });
      const tweetId = '1450144651940294656';
      await Quest.create({ type: 'verify', name: `verify-${quest.id}-${tweetId}` });
      await request(app.getHttpServer())
        .post(`/v1/airdrop/request-verify/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .send({ link: 'https://twitter.com/StarTrek/status/1450144651940294656' })
        .expect(400)
        .expect({
          error: {
            type: 'invalid_request_error',
            message: 'Verification request already exists',
          },
        });
    });

    it('should return 400 when twitter url has been used by twitter engagement record', async () => {
      await TwitterEngagement.create({ tweetId: '1450144651940294656' });
      const quest = await Quest.create({ type: 'tweet' });
      await request(app.getHttpServer())
        .post(`/v1/airdrop/request-verify/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .send({ link: 'https://twitter.com/StarTrek/status/1450144651940294656' })
        .expect(400)
        .expect({
          error: {
            type: 'invalid_request_error',
            message: 'Link already used for another quest',
          },
        });
    });

    it('should return 400 when max request reached', async () => {
      const quest = await Quest.create({ type: 'tweet' });
      await Quest.create({ type: 'verify', responderId: u.id });
      await Quest.create({ type: 'verify', responderId: u.id });
      await Quest.create({ type: 'verify', responderId: u.id });
      await request(app.getHttpServer())
        .post(`/v1/airdrop/request-verify/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .send({ link: 'https://twitter.com/StarTrek/status/1450144651940294656' })
        .expect(400)
        .expect({
          error: {
            type: 'invalid_request_error',
            message: 'You have reached the maximum daily limit',
          },
        });
    });

    it('should return 400 when link was already used', async () => {
      const quest = await Quest.create({ type: 'tweet' });
      await Quest.create({ tweetId: '1450144651940294656' });
      await request(app.getHttpServer())
        .post(`/v1/airdrop/request-verify/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .send({ link: 'https://twitter.com/StarTrek/status/1450144651940294656' })
        .expect(400)
        .expect({
          error: {
            type: 'invalid_request_error',
            message: 'Link already used for another quest',
          },
        });
    });

    it('should return 201 when link was already used', async () => {
      const quest = await Quest.create({ type: 'tweet' });
      await request(app.getHttpServer())
        .post(`/v1/airdrop/request-verify/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .send({ link: 'https://twitter.com/StarTrek/status/1450144651940294656' })
        .expect(201);
      const verifyQuest = await Quest.findByQuestId(quest.id);
      expect(verifyQuest).toBeDefined();
      expect(verifyQuest.tweetId).toEqual('1450144651940294656');
    });

    it('should return 201 and create verify follow quest', async () => {
      const quest = await Quest.create({ type: 'follow', engageBond: 100 });
      await Quest.create({});
      await request(app.getHttpServer())
        .post(`/v1/airdrop/request-verify/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .send({})
        .expect(201)
        .expect(async (res) => {
          expect(res.body.data.type).toEqual('verify');
          const point = await Point.getByName(`engage-bond-${res.body.data.id}-${u.id}`);
          expect(point).toBeDefined();
          expect(point.point).toEqual('-100');
          expect(point.action).toEqual(PointAction.QuestBond);
          expect(point.address).toEqual(u.address);
        });
    });
  });

  describe('.voteQuest', () => {
    it('should return 401 when no authorization', async () => {
      await request(app.getHttpServer())
        .post(`/v1/airdrop/vote-quest/unknown`)
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 400 when vote was not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/airdrop/vote-quest/unknown`)
        .set('Authorization', 'bearer ' + token)
        .expect(400)
        .expect({
          error: {
            message: 'vote is required',
            param: 'vote',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when vote was invalid', async () => {
      await request(app.getHttpServer())
        .post(`/v1/airdrop/vote-quest/unknown`)
        .set('Authorization', 'bearer ' + token)
        .send({ vote: 2 })
        .expect(400)
        .expect({
          error: {
            message: 'vote must be 0 or 1',
            param: 'vote',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when quest was not founded', async () => {
      await request(app.getHttpServer())
        .post(`/v1/airdrop/vote-quest/unknown`)
        .set('Authorization', 'bearer ' + token)
        .send({ vote: 1 })
        .expect(400)
        .expect({
          error: { type: 'invalid_request_error', message: 'Quest not found' },
        });
    });

    it('should return 400 when quest type is invalid', async () => {
      const quest = await Quest.create({});
      await request(app.getHttpServer())
        .post(`/v1/airdrop/vote-quest/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .send({ vote: 1 })
        .expect(400)
        .expect({
          error: { type: 'invalid_request_error', message: 'Invalid quest type' },
        });
    });

    it('should return 400 when quest has been finalized', async () => {
      const quest = await Quest.create({ type: 'verify', finalized: true });
      await request(app.getHttpServer())
        .post(`/v1/airdrop/vote-quest/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .send({ vote: 1 })
        .expect(400)
        .expect({
          error: { type: 'invalid_request_error', message: 'Quest already finalized' },
        });
    });

    it('should return 400 when auth user ID already voted', async () => {
      const quest = await Quest.create({ type: 'verify', voters: [u.id] });
      await request(app.getHttpServer())
        .post(`/v1/airdrop/vote-quest/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .send({ vote: 1 })
        .expect(400)
        .expect({
          error: { type: 'invalid_request_error', message: 'Already voted' },
        });
    });

    it('should return 400 when auth user address already voted', async () => {
      const quest = await Quest.create({ type: 'verify', voters: [u.address.toLowerCase()] });
      await request(app.getHttpServer())
        .post(`/v1/airdrop/vote-quest/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .send({ vote: 1 })
        .expect(400)
        .expect({
          error: { type: 'invalid_request_error', message: 'Already voted' },
        });
    });

    it('should return 400 when quest parent is unset', async () => {
      const quest = await Quest.create({ type: 'verify' });
      await request(app.getHttpServer())
        .post(`/v1/airdrop/vote-quest/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .send({ vote: 1 })
        .expect(400)
        .expect({
          error: { type: 'invalid_request_error', message: 'Parent quest not found' },
        });
    });

    it('should return 400 when quest parent is unset', async () => {
      const quest = await Quest.create({ type: 'verify' });
      await request(app.getHttpServer())
        .post(`/v1/airdrop/vote-quest/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .send({ vote: 1 })
        .expect(400)
        .expect({
          error: { type: 'invalid_request_error', message: 'Parent quest not found' },
        });
    });

    it('should return 400 when quest responder is unknown', async () => {
      const parentQuest = await Quest.create({ type: 'follow' });
      const quest = await Quest.create({ type: 'verify', questId: parentQuest.id, responderId: '123' });
      await request(app.getHttpServer())
        .post(`/v1/airdrop/vote-quest/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .send({ vote: 1 })
        .expect(400)
        .expect({
          error: { type: 'invalid_request_error', message: 'Responder not found' },
        });
    });

    describe('parent quest with maxVoters=3', () => {
      let parentQuest: Quest;

      beforeEach(async () => {
        parentQuest = await Quest.create({
          type: 'follow',
          maxVotes: 3,
          engageBond: 100,
          engagePoints: 120,
          verifyBond: 200,
          verifyPoints: 240,
        });
      });

      it('should correctly update state when one YES vote is cast', async () => {
        const responder = await User.create({ address: '0xAddress2' });
        const quest = await Quest.create({ type: 'verify', questId: parentQuest.id, responderId: responder.id });
        await request(app.getHttpServer())
          .post(`/v1/airdrop/vote-quest/${quest.id}`)
          .set('Authorization', 'bearer ' + token)
          .send({ vote: 1 })
          .expect(201)
          .expect({
            data: { ok: true },
          });

        const updatedQuest = await Quest.query().findById(quest.id);
        expect(updatedQuest.voters).toEqual([u.id, u.address.toLocaleLowerCase()]);
        expect(updatedQuest.votes).toEqual({ [u.id]: 1, [u.address.toLowerCase()]: 1 });
        expect(updatedQuest.voteYes).toEqual(1);
        expect(updatedQuest.voteNo).toEqual(0);
        expect(updatedQuest.finalized).toEqual(false);

        const bondPoint = await Point.getByName(`verify-bond-${quest.id}-${u.id}`);
        expect(bondPoint).toBeDefined();
        expect(bondPoint.address).toEqual(u.address);
        expect(bondPoint.point).toEqual('-200');
        expect(bondPoint.action).toEqual(PointAction.QuestBond);
      });

      it('should correctly update state when one NO vote is cast', async () => {
        const responder = await User.create({ address: '0xAddress2' });
        const quest = await Quest.create({ type: 'verify', questId: parentQuest.id, responderId: responder.id });
        await request(app.getHttpServer())
          .post(`/v1/airdrop/vote-quest/${quest.id}`)
          .set('Authorization', 'bearer ' + token)
          .send({ vote: 0 })
          .expect(201)
          .expect({
            data: { ok: true },
          });

        const updatedQuest = await Quest.query().findById(quest.id);
        expect(updatedQuest.voters).toEqual([u.id, u.address.toLocaleLowerCase()]);
        expect(updatedQuest.votes).toEqual({ [u.id]: 0, [u.address.toLowerCase()]: 0 });
        expect(updatedQuest.voteYes).toEqual(0);
        expect(updatedQuest.voteNo).toEqual(1);
        expect(updatedQuest.finalized).toEqual(false);
      });

      it('should correctly update state when two votes are cast', async () => {
        const responder = await User.create({ address: '0xAddress2' });
        const quest = await Quest.create({ type: 'verify', questId: parentQuest.id, responderId: responder.id });

        await request(app.getHttpServer())
          .post(`/v1/airdrop/vote-quest/${quest.id}`)
          .set('Authorization', 'bearer ' + token)
          .send({ vote: 1 })
          .expect(201)
          .expect({
            data: { ok: true },
          });

        await request(app.getHttpServer())
          .post(`/v1/airdrop/vote-quest/${quest.id}`)
          .set('Authorization', 'bearer ' + token2)
          .send({ vote: 0 })
          .expect(201)
          .expect({
            data: { ok: true },
          });

        const updatedQuest = await Quest.query().findById(quest.id);
        expect(updatedQuest.voters).toEqual([u.id, u.address.toLocaleLowerCase(), u2.id, u2.address.toLowerCase()]);
        expect(updatedQuest.votes).toEqual({
          [u.id]: 1,
          [u.address.toLowerCase()]: 1,
          [u2.id]: 0,
          [u2.address.toLowerCase()]: 0,
        });
        expect(updatedQuest.voteYes).toEqual(1);
        expect(updatedQuest.voteNo).toEqual(1);
        expect(updatedQuest.finalized).toEqual(false);

        const bondPoint = await Point.getByName(`verify-bond-${quest.id}-${u.id}`);
        expect(bondPoint).toBeDefined();
        expect(bondPoint.address).toEqual(u.address);
        expect(bondPoint.point).toEqual('-200');
        expect(bondPoint.action).toEqual(PointAction.QuestBond);

        const bondPoint2 = await Point.getByName(`verify-bond-${quest.id}-${u2.id}`);
        expect(bondPoint2).toBeDefined();
        expect(bondPoint2.address).toEqual(u2.address);
        expect(bondPoint2.point).toEqual('-200');
        expect(bondPoint2.action).toEqual(PointAction.QuestBond);
      });

      it('should correctly update state when three votes are cast (YES win)', async () => {
        const responder = await User.create({ address: '0xAddress2' });
        const quest = await Quest.create({ type: 'verify', questId: parentQuest.id, responderId: responder.id });

        await request(app.getHttpServer())
          .post(`/v1/airdrop/vote-quest/${quest.id}`)
          .set('Authorization', 'bearer ' + token)
          .send({ vote: 1 })
          .expect(201)
          .expect({
            data: { ok: true },
          });

        await request(app.getHttpServer())
          .post(`/v1/airdrop/vote-quest/${quest.id}`)
          .set('Authorization', 'bearer ' + token2)
          .send({ vote: 0 })
          .expect(201)
          .expect({
            data: { ok: true },
          });

        await request(app.getHttpServer())
          .post(`/v1/airdrop/vote-quest/${quest.id}`)
          .set('Authorization', 'bearer ' + token3)
          .send({ vote: 1 })
          .expect(201)
          .expect({
            data: { ok: true },
          });

        const updatedQuest = await Quest.query().findById(quest.id);
        expect(updatedQuest.voters).toEqual([
          u.id,
          u.address.toLocaleLowerCase(),
          u2.id,
          u2.address.toLowerCase(),
          u3.id,
          u3.address.toLowerCase(),
        ]);
        expect(updatedQuest.votes).toEqual({
          [u.id]: 1,
          [u.address.toLowerCase()]: 1,
          [u2.id]: 0,
          [u2.address.toLowerCase()]: 0,
          [u3.id]: 1,
          [u3.address.toLowerCase()]: 1,
        });
        expect(updatedQuest.voteYes).toEqual(2);
        expect(updatedQuest.voteNo).toEqual(1);
        expect(updatedQuest.finalized).toEqual(true);

        const bondPoint = await Point.getByName(`verify-bond-${quest.id}-${u.id}`);
        expect(bondPoint).toBeDefined();
        expect(bondPoint.address).toEqual(u.address);
        expect(bondPoint.point).toEqual('-200');
        expect(bondPoint.action).toEqual(PointAction.QuestBond);

        const bondPoint2 = await Point.getByName(`verify-bond-${quest.id}-${u2.id}`);
        expect(bondPoint2).toBeDefined();
        expect(bondPoint2.address).toEqual(u2.address);
        expect(bondPoint2.point).toEqual('-200');
        expect(bondPoint2.action).toEqual(PointAction.QuestBond);

        const bondPoint3 = await Point.getByName(`verify-bond-${quest.id}-${u3.id}`);
        expect(bondPoint3).toBeDefined();
        expect(bondPoint3.address).toEqual(u3.address);
        expect(bondPoint3.point).toEqual('-200');
        expect(bondPoint3.action).toEqual(PointAction.QuestBond);

        const updatedResponderBond = await Point.getByName(`quest-${quest.id}-${responder.id}-reward`);
        expect(updatedResponderBond).toBeDefined();
        expect(updatedResponderBond.address).toEqual(responder.address);
        expect(updatedResponderBond.point).toEqual('220');
        expect(updatedResponderBond.action).toEqual(PointAction.Quest);

        const user1Points = await Point.getByName(`quest-${quest.id}-${u.address.toLowerCase()}-voter-reward`);
        expect(user1Points).toBeDefined();
        expect(user1Points.address).toEqual(u.address.toLowerCase());
        expect(user1Points.point).toEqual('440');
        expect(user1Points.action).toEqual(PointAction.Quest);

        const user3Points = await Point.getByName(`quest-${quest.id}-${u3.address.toLowerCase()}-voter-reward`);
        expect(user3Points).toBeDefined();
        expect(user3Points.address).toEqual(u3.address.toLowerCase());
        expect(user3Points.point).toEqual('440');
        expect(user3Points.action).toEqual(PointAction.Quest);

        // U2 get nothing
        const user2Points = await Point.getByName(`quest-${quest.id}-${u2.address.toLowerCase()}-voter-reward`);
        expect(user2Points).not.toBeDefined();
      });

      it('should correctly update state when three votes are cast (NO win)', async () => {
        const responder = await User.create({ address: '0xAddress2' });
        const quest = await Quest.create({ type: 'verify', questId: parentQuest.id, responderId: responder.id });

        await request(app.getHttpServer())
          .post(`/v1/airdrop/vote-quest/${quest.id}`)
          .set('Authorization', 'bearer ' + token)
          .send({ vote: 0 })
          .expect(201)
          .expect({
            data: { ok: true },
          });

        await request(app.getHttpServer())
          .post(`/v1/airdrop/vote-quest/${quest.id}`)
          .set('Authorization', 'bearer ' + token2)
          .send({ vote: 1 })
          .expect(201)
          .expect({
            data: { ok: true },
          });

        await request(app.getHttpServer())
          .post(`/v1/airdrop/vote-quest/${quest.id}`)
          .set('Authorization', 'bearer ' + token3)
          .send({ vote: 0 })
          .expect(201)
          .expect({
            data: { ok: true },
          });

        const updatedQuest = await Quest.query().findById(quest.id);
        expect(updatedQuest.voters).toEqual([
          u.id,
          u.address.toLocaleLowerCase(),
          u2.id,
          u2.address.toLowerCase(),
          u3.id,
          u3.address.toLowerCase(),
        ]);
        expect(updatedQuest.votes).toEqual({
          [u.id]: 0,
          [u.address.toLowerCase()]: 0,
          [u2.id]: 1,
          [u2.address.toLowerCase()]: 1,
          [u3.id]: 0,
          [u3.address.toLowerCase()]: 0,
        });
        expect(updatedQuest.voteYes).toEqual(1);
        expect(updatedQuest.voteNo).toEqual(2);
        expect(updatedQuest.finalized).toEqual(true);

        const bondPoint = await Point.getByName(`verify-bond-${quest.id}-${u.id}`);
        expect(bondPoint).toBeDefined();
        expect(bondPoint.address).toEqual(u.address);
        expect(bondPoint.point).toEqual('-200');
        expect(bondPoint.action).toEqual(PointAction.QuestBond);

        const bondPoint2 = await Point.getByName(`verify-bond-${quest.id}-${u2.id}`);
        expect(bondPoint2).toBeDefined();
        expect(bondPoint2.address).toEqual(u2.address);
        expect(bondPoint2.point).toEqual('-200');
        expect(bondPoint2.action).toEqual(PointAction.QuestBond);

        const bondPoint3 = await Point.getByName(`verify-bond-${quest.id}-${u3.id}`);
        expect(bondPoint3).toBeDefined();
        expect(bondPoint3.address).toEqual(u3.address);
        expect(bondPoint3.point).toEqual('-200');
        expect(bondPoint3.action).toEqual(PointAction.QuestBond);

        const updatedResponderBond = await Point.getByName(`quest-${quest.id}-${responder.id}-reward`);
        expect(updatedResponderBond).not.toBeDefined();

        const user1Points = await Point.getByName(`quest-${quest.id}-${u.address.toLowerCase()}-voter-reward`);
        expect(user1Points).toBeDefined();
        expect(user1Points.address).toEqual(u.address.toLowerCase());
        expect(user1Points.point).toEqual('440');
        expect(user1Points.action).toEqual(PointAction.Quest);

        const user3Points = await Point.getByName(`quest-${quest.id}-${u3.address.toLowerCase()}-voter-reward`);
        expect(user3Points).toBeDefined();
        expect(user3Points.address).toEqual(u3.address.toLowerCase());
        expect(user3Points.point).toEqual('440');
        expect(user3Points.action).toEqual(PointAction.Quest);

        // U2 get nothing
        const user2Points = await Point.getByName(`quest-${quest.id}-${u2.address.toLowerCase()}-voter-reward`);
        expect(user2Points).not.toBeDefined();
      });

      it('should correctly update state when two votes are cast (neither YES or NO win)', async () => {
        await Quest.updateById(parentQuest.id, { maxVotes: 2 });

        const responder = await User.create({ address: '0xAddress2' });
        const quest = await Quest.create({ type: 'verify', questId: parentQuest.id, responderId: responder.id });

        await request(app.getHttpServer())
          .post(`/v1/airdrop/vote-quest/${quest.id}`)
          .set('Authorization', 'bearer ' + token)
          .send({ vote: 0 })
          .expect(201)
          .expect({
            data: { ok: true },
          });

        await request(app.getHttpServer())
          .post(`/v1/airdrop/vote-quest/${quest.id}`)
          .set('Authorization', 'bearer ' + token2)
          .send({ vote: 1 })
          .expect(201)
          .expect({
            data: { ok: true },
          });

        const updatedQuest = await Quest.query().findById(quest.id);
        expect(updatedQuest.voters).toEqual([u.id, u.address.toLocaleLowerCase(), u2.id, u2.address.toLowerCase()]);
        expect(updatedQuest.votes).toEqual({
          [u.id]: 0,
          [u.address.toLowerCase()]: 0,
          [u2.id]: 1,
          [u2.address.toLowerCase()]: 1,
        });
        expect(updatedQuest.voteYes).toEqual(1);
        expect(updatedQuest.voteNo).toEqual(1);
        expect(updatedQuest.finalized).toEqual(true);

        const bondPoint = await Point.getByName(`verify-bond-${quest.id}-${u.id}`);
        expect(bondPoint).toBeDefined();
        expect(bondPoint.address).toEqual(u.address);
        expect(bondPoint.point).toEqual('-200');
        expect(bondPoint.action).toEqual(PointAction.QuestBond);

        const bondPoint2 = await Point.getByName(`verify-bond-${quest.id}-${u2.id}`);
        expect(bondPoint2).toBeDefined();
        expect(bondPoint2.address).toEqual(u2.address);
        expect(bondPoint2.point).toEqual('-200');
        expect(bondPoint2.action).toEqual(PointAction.QuestBond);

        const updatedResponderBond = await Point.getByName(`quest-${quest.id}-${responder.id}-reward`);
        expect(updatedResponderBond).not.toBeDefined();

        const user1Points = await Point.getByName(`quest-${quest.id}-${u.address.toLowerCase()}-voter-reward`);
        expect(user1Points).not.toBeDefined();

        // U2 get nothing
        const user2Points = await Point.getByName(`quest-${quest.id}-${u2.address.toLowerCase()}-voter-reward`);
        expect(user2Points).not.toBeDefined();
      });
    });
  });

  describe('.verifySwapQuest', () => {
    it('should return 401 when no authorization', async () => {
      await request(app.getHttpServer())
        .post(`/v1/airdrop/verify-swap/unknown`)
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 400 when quest was not found', async () => {
      await request(app.getHttpServer())
        .post(`/v1/airdrop/verify-swap/unknown`)
        .set('Authorization', 'bearer ' + token)
        .expect(400)
        .expect({
          error: {
            type: 'invalid_request_error',
            message: 'Quest not found',
          },
        });
    });

    it('should return 400 when quest type is not `swap`', async () => {
      const quest = await Quest.create({});
      await Point.create({ name: `swap-verify-${quest.id}-${u.id}` });
      await request(app.getHttpServer())
        .post(`/v1/airdrop/verify-swap/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .expect(400)
        .expect({
          error: {
            type: 'invalid_request_error',
            message: 'Invalid quest type',
          },
        });
    });

    it('should return 400 when points have been previously awarded', async () => {
      const quest = await Quest.create({ type: 'swap' });
      const startOfToday = moment().utc().startOf('day').toISOString();
      await Point.create({ name: `swap-verify-${quest.id}-${u.id}-${startOfToday}` });
      await request(app.getHttpServer())
        .post(`/v1/airdrop/verify-swap/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .expect(400)
        .expect({
          error: {
            type: 'invalid_request_error',
            message: 'Already verified',
          },
        });
    });

    it('should return 400 when required number of swap has not been reached', async () => {
      const quest = await Quest.create({ type: 'swap', count: '2' });
      await request(app.getHttpServer())
        .post(`/v1/airdrop/verify-swap/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .expect(400)
        .expect({
          error: {
            type: 'invalid_request_error',
            message: 'Not enough swaps completed (2 to go)',
          },
        });
    });

    it('should return 201 when required number of swap has been created', async () => {
      await Swap.create({ marketAddress: '0xMarket', provider: '0xProvider', lid: 0, taker: u.address });
      await Swap.create({ marketAddress: '0xMarket', provider: '0xProvider', lid: 0, taker: u.address });
      const quest = await Quest.create({
        type: 'swap',
        count: '2',
        marketAddress: '0xMarket',
        provider: '0xProvider',
        lid: 0,
        engagePoints: 120,
      });
      await request(app.getHttpServer())
        .post(`/v1/airdrop/verify-swap/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .expect(201);

      const startOfToday = moment().utc().startOf('day').toISOString();
      const point = await Point.getByName(`swap-verify-${quest.id}-${u.id}-${startOfToday}`);
      expect(point).toBeDefined();
      expect(point.point).toEqual(quest.engagePoints.toString());
      expect(point.action).toEqual(PointAction.Quest);
      expect(point.address).toEqual(u.address);

      await request(app.getHttpServer())
        .post(`/v1/airdrop/verify-swap/${quest.id}`)
        .set('Authorization', 'bearer ' + token)
        .expect({
          error: {
            type: 'invalid_request_error',
            message: 'Already verified',
          },
        });
    });
  });
});
