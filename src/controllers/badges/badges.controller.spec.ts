import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as moment from 'moment/moment';
import * as request from 'supertest';
import { randStr } from '../../common/common';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { Roles } from '../../common/roles';
import { DBService } from '../../db/db.service';
import Badge from '../../models/badge';
import BadgeGrant from '../../models/badge_grant';
import User from '../../models/user';
import { makeSession } from '../auth/utils';
import { BadgeService } from './badge.service';
import { BadgesController } from './badges.controller';

jest.mock('@jointlabs/meta', () => {
  const actual = jest.requireActual('@jointlabs/meta');
  return {
    ...actual,
    BadgeManifest: {},
  };
});

describe('BadgesController', () => {
  let app: INestApplication;
  const db = DBService.getForTest();

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
    jest.resetModules();

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [BadgesController],
      providers: [BadgeService],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  let u: User;
  const net = 'ethereum';
  beforeEach(async () => {
    u = await User.create({ role: Roles.User });
    await makeSession(u, randStr(), '5', 'secret');
  });

  describe('.listBadges', function () {
    it('should return 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/badges`)
        .query({ net: 'net1' })
        .send({})
        .expect(400)
        .expect({
          error: {
            message: 'network is unknown',
            param: 'net',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 200 and empty data when no badge exists', async () => {
      await request(app.getHttpServer()).get(`/v1/badges`).query({ net }).send({}).expect(200).expect({
        data: [],
      });
    });

    it('should return 200 and correct data when [query=badge] is set', async () => {
      const badge = await Badge.create({ network: net, badge: 'badge' });
      const badge2 = await Badge.create({ network: net, badge: 'badge2' });
      await request(app.getHttpServer())
        .get(`/v1/badges`)
        .query({ net, badge: badge.badge })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(badge.id);
        });
      await request(app.getHttpServer())
        .get(`/v1/badges`)
        .query({ net, badge: badge2.badge })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(badge2.id);
        });
    });

    it('should return 200 and correct data when [query=path] is set', async () => {
      const badge = await Badge.create({ network: net, path: 'path' });
      await Badge.create({ network: net, path: 'path2' });
      await request(app.getHttpServer())
        .get(`/v1/badges`)
        .query({ net, path: badge.path })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(badge.id);
        });
    });

    it('should return 200 and correct data when [query=badge,path] is set', async () => {
      const badge = await Badge.create({ network: net, badge: 'badge', path: 'path' });
      await Badge.create({ network: net, badge: 'badge', path: 'path2' });
      await request(app.getHttpServer())
        .get(`/v1/badges`)
        .query({ net, badge: badge.badge, path: badge.path })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(badge.id);
        });
    });

    it('should return 200 and correct data when [query=issuer] is set', async () => {
      const badge = await Badge.create({ network: net, issuer: 'issuer' });
      await Badge.create({ network: net, issuer: 'issuer2' });
      await request(app.getHttpServer())
        .get(`/v1/badges`)
        .query({ net, issuer: badge.issuer })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(badge.id);
        });
    });

    it('should return 200 and correct data when [query=coIssuer] is set', async () => {
      const badge = await Badge.create({ network: net, coIssuer: 'coIssuer' });
      await Badge.create({ network: net, coIssuer: 'coIssuer2' });
      await request(app.getHttpServer())
        .get(`/v1/badges`)
        .query({ net, coIssuer: badge.coIssuer })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(badge.id);
        });
    });

    it('should return 200 and correct data when [query=count] is set', async () => {
      await Badge.create({ network: net, coIssuer: 'coIssuer' });
      await Badge.create({ network: net, coIssuer: 'coIssuer2' });
      await request(app.getHttpServer())
        .get(`/v1/badges`)
        .query({ net, count: true })
        .expect(200)
        .expect({ data: { count: '2' } });
    });

    it('should return 200 and correct data when [query=select] is set', async () => {
      await Badge.create({ network: net });
      await Badge.create({ network: net });
      await request(app.getHttpServer())
        .get(`/v1/badges`)
        .query({ net, select: 'id' })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(2);
          expect(res.body.data[0]).toHaveProperty('id');
          expect(res.body.data[1]).toHaveProperty('id');
        });
    });

    it('should return 200 and correct data when [query=limit,offet] are set', async () => {
      const badge = await Badge.create({ network: net });
      const badge2 = await Badge.create({ network: net });
      await request(app.getHttpServer())
        .get(`/v1/badges`)
        .query({ net, limit: 1, offset: 0 })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(badge2.id);
        });
      await request(app.getHttpServer())
        .get(`/v1/badges`)
        .query({ net, limit: 1, offset: 1 })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(badge.id);
        });
    });
  });

  describe('.listGrantedBadges', function () {
    it('should return 400 when network is unknown', async () => {
      await request(app.getHttpServer())
        .get(`/v1/badges/granted`)
        .query({ net: 'net1' })
        .send({})
        .expect(400)
        .expect({
          error: {
            message: 'network is unknown',
            param: 'net',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 200 and empty data when no badge exists', async () => {
      await request(app.getHttpServer()).get(`/v1/badges/granted`).query({ net }).send({}).expect(200).expect({
        data: [],
      });
    });

    it('should return 200 and correct data when [query=badge] is set', async () => {
      const grant = await BadgeGrant.create({ network: net, badge: 'badge' });
      const grant2 = await BadgeGrant.create({ network: net, badge: 'badge2' });
      await request(app.getHttpServer())
        .get(`/v1/badges/granted`)
        .query({ net, badge: grant.badge })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(grant.id);
        });
      await request(app.getHttpServer())
        .get(`/v1/badges/granted`)
        .query({ net, badge: grant2.badge })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(grant2.id);
        });
    });

    it('should return 200 and correct data when [query=path] is set', async () => {
      const grant = await BadgeGrant.create({ network: net, path: 'path' });
      await BadgeGrant.create({ network: net, path: 'path2' });
      await request(app.getHttpServer())
        .get(`/v1/badges/granted`)
        .query({ net, path: grant.path })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(grant.id);
        });
    });

    it('should return 200 and correct data when [query=grantee] is set', async () => {
      const grant = await BadgeGrant.create({ network: net, grantee: '0xGrantee' });
      await BadgeGrant.create({ network: net, grantee: '0xGrantee2' });
      await request(app.getHttpServer())
        .get(`/v1/badges/granted`)
        .query({ net, grantee: grant.grantee })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(grant.id);
        });
    });

    it('should return 200 and correct count when [query=count] is set', async () => {
      await BadgeGrant.create({ network: net, grantee: '0xGrantee' });
      await BadgeGrant.create({ network: net, grantee: '0xGrantee2' });
      await request(app.getHttpServer())
        .get(`/v1/badges/granted`)
        .query({ net, count: true })
        .expect(200)
        .expect({
          data: { count: '2' },
        });
    });

    it('should return 200 and correct count when [query=limit,offset] is set', async () => {
      const now = moment();
      const grant = await BadgeGrant.create({ network: net, grantee: '0xGrantee', updatedAt: now.toISOString() });
      const grant2 = await BadgeGrant.create({
        network: net,
        grantee: '0xGrantee2',
        updatedAt: now.add(1, 's').toISOString(),
      });
      await request(app.getHttpServer())
        .get(`/v1/badges/granted`)
        .query({ net, limit: 1, offset: 0 })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(grant2.id);
        });

      await request(app.getHttpServer())
        .get(`/v1/badges/granted`)
        .query({ net, limit: 1, offset: 1 })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].id).toEqual(grant.id);
        });
    });
  });
});
