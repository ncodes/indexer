import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import { DBService } from '../db/DBService';
import { InstructionsController } from './instructions.controller';
import { AllExceptionsFilter } from '../common/interceptors/exception_filter';
import { NoopLogger } from '../common/loggers/noop_logger';
import { InstructionsService } from './instructions.service';
import User from '../models/user';
import { Roles } from '../common/roles';
import { makeSession } from '../controllers/auth/utils';
import { randStr } from '../common/common';
import * as randstring from 'randomstring';
import NetworkService from '../network/network.service';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

const NetworkServiceMock = jest.fn().mockImplementation(() => {
  return {};
});

describe('InstructionsController', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  const net = 'ethereum';
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
      controllers: [InstructionsController],
      providers: [InstructionsService, NetworkService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(NetworkService)
      .useValue(new NetworkServiceMock())
      .compile();
    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  let u: User;
  let token: string;
  beforeEach(async () => {
    u = await User.create({ role: Roles.User, address: '0xAddress' });
    token = await makeSession(u, randStr(), '5', mockCfgGet('auth.jwtSecret'));
  });

  describe('.update', function () {
    it('should return 401 when authorization was not provided', async () => {
      await request(app.getHttpServer())
        .put(`/v1/instructions`)
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 400 when not authorized', async () => {
      await request(app.getHttpServer())
        .put(`/v1/instructions`)
        .set('Authorization', 'bearer xyz')
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'not permitted to perform this action',
          },
        });
    });

    it('should return 400 when network was not provided', async () => {
      await request(app.getHttpServer())
        .put(`/v1/instructions`)
        .set('Authorization', 'bearer ' + token)
        .expect(400)
        .expect({
          error: {
            message: 'network is required',
            param: 'net',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when content was not provided', async () => {
      await request(app.getHttpServer())
        .put(`/v1/instructions`)
        .set('Authorization', 'bearer ' + token)
        .send({
          net: net,
        })
        .expect(400)
        .expect({
          error: {
            message: 'content is required',
            param: 'content',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when content is too long', async () => {
      const content = randstring.generate({ length: 251 });
      await request(app.getHttpServer())
        .put(`/v1/instructions`)
        .set('Authorization', 'bearer ' + token)
        .send({
          net: net,
          content,
        })
        .expect(400)
        .expect({
          error: {
            message: 'content is too long',
            param: 'content',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 when one of marketAddress,provider,lid is set but not the others', async () => {
      await request(app.getHttpServer())
        .put(`/v1/instructions`)
        .set('Authorization', 'bearer ' + token)
        .send({
          net: net,
          content: 'content',
          marketAddress: '0xMarketAddress',
        })
        .expect(400)
        .expect({
          error: {
            message: 'provider is required',
            param: 'provider',
            type: 'invalid_request_error',
          },
        });
      await request(app.getHttpServer())
        .put(`/v1/instructions`)
        .set('Authorization', 'bearer ' + token)
        .send({
          net: net,
          content: 'content',
          marketAddress: '0xMarketAddress',
          provider: '0xProvider',
        })
        .expect(400)
        .expect({
          error: {
            message: 'lid is required',
            param: 'lid',
            type: 'invalid_request_error',
          },
        });
    });

    describe('when no instruction exist', () => {
      it('should return 200 and pin the correct instruction', async () => {
        const content = 'content';
        const mockGet = jest.spyOn(app.get(InstructionsService), 'get').mockResolvedValue([undefined, undefined]);
        const mockPin = jest.spyOn(app.get(InstructionsService), 'pin').mockResolvedValue('0xHash');
        await request(app.getHttpServer())
          .put(`/v1/instructions`)
          .set('Authorization', 'bearer ' + token)
          .send({
            net: net,
            content,
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.data.hash).toBe('0xHash');
            expect(mockGet).toBeCalledWith(`${u.address}:${net}`);
            expect(mockPin).toBeCalledWith({ global: content, liquidity: {} }, `${u.address}:${net}`);
          });
      });

      it('should return 200 and pin the correct instruction for liquidity', async () => {
        const content = 'content';
        const mockGet = jest.spyOn(app.get(InstructionsService), 'get').mockResolvedValue([undefined, undefined]);
        const mockPin = jest.spyOn(app.get(InstructionsService), 'pin').mockResolvedValue('0xHash');
        await request(app.getHttpServer())
          .put(`/v1/instructions`)
          .set('Authorization', 'bearer ' + token)
          .send({
            net: net,
            content,
            marketAddress: '0xMarketAddress',
            provider: '0xProvider',
            lid: 1,
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.data.hash).toBe('0xHash');
            expect(mockGet).toBeCalledWith(`${u.address}:${net}`);
            expect(mockPin).toBeCalledWith(
              { global: '', liquidity: { '0xMarketAddress:0xProvider:1': content } },
              `${u.address}:${net}`,
            );
          });
      });
    });

    describe('when instruction already exist', () => {
      it('should return 200 and pin the correct instruction', async () => {
        const content = 'content';
        const hash = '0xHash';
        const mockGet = jest
          .spyOn(app.get(InstructionsService), 'get')
          .mockResolvedValue([{ global: 'stuff', liquidity: { liq: 'stuff' } }, hash]);

        const mockGetGrantSignature = jest
          .spyOn(app.get(InstructionsService), 'getGrantSignature')
          .mockResolvedValue({ network: net, isNew: true, sig: '0xSig', values: ['1'] });

        const mockPin = jest.spyOn(app.get(InstructionsService), 'pin').mockResolvedValue('0xHash');
        await request(app.getHttpServer())
          .put(`/v1/instructions`)
          .set('Authorization', 'bearer ' + token)
          .send({
            net: net,
            content,
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.data.hash).toBe('0xHash');
            expect(res.body.data.sigInfo).toEqual({ network: net, isNew: true, sig: '0xSig', values: ['1'] });
            expect(mockGet).toBeCalledWith(`${u.address}:${net}`);
            expect(mockPin).toBeCalledWith({ global: content, liquidity: { liq: 'stuff' } }, `${u.address}:${net}`);
            expect(mockGetGrantSignature).toBeCalledWith(net, u.address, hash);
          });
      });

      it('should return 200 and pin the correct instruction for liquidity', async () => {
        const content = 'content';
        const hash = '0xHash';

        const mockGet = jest
          .spyOn(app.get(InstructionsService), 'get')
          .mockResolvedValue([{ global: 'stuff', liquidity: { '0xmarketaddress:0xprovider:1': 'stuff' } }, hash]);

        const mockPin = jest.spyOn(app.get(InstructionsService), 'pin').mockResolvedValue('0xHash');

        const mockGetGrantSignature = jest
          .spyOn(app.get(InstructionsService), 'getGrantSignature')
          .mockResolvedValue({ network: net, isNew: true, sig: '0xSig', values: ['1'] });

        await request(app.getHttpServer())
          .put(`/v1/instructions`)
          .set('Authorization', 'bearer ' + token)
          .send({
            net: net,
            content,
            marketAddress: '0xMarketAddress',
            provider: '0xProvider',
            lid: 1,
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.data.hash).toBe('0xHash');
            expect(mockGet).toBeCalledWith(`${u.address}:${net}`);
            expect(mockPin).toBeCalledWith(
              { global: 'stuff', liquidity: { '0xmarketaddress:0xprovider:1': content } },
              `${u.address}:${net}`,
            );
            expect(mockGetGrantSignature).toBeCalledWith(net, u.address, hash);
          });
      });
    });
  });

  describe('.get', () => {
    it('should return 400 when network was not provided', async () => {
      const mockGet = jest.spyOn(app.get(InstructionsService), 'get').mockResolvedValue([undefined, undefined]);
      await request(app.getHttpServer())
        .get(`/v1/instructions/ethereum/0xAddress`)
        .set('Authorization', 'bearer ' + token)
        .expect(404)
        .expect((res) => {
          expect(res.body.error.message).toBe('instruction not found');
          expect(mockGet).toBeCalledWith(`0xAddress:ethereum`);
        });
    });

    it('should return 200 when instruction exists', async () => {
      const content = 'content';
      const hash = '0xHash';
      const instruction = { global: content, liquidity: { '0xMarketAddress:0xProvider:1': content } };
      jest.spyOn(app.get(InstructionsService), 'get').mockResolvedValue([instruction, hash]);
      await request(app.getHttpServer())
        .get(`/v1/instructions/ethereum/0xAddress`)
        .set('Authorization', 'bearer ' + token)
        .expect(200)
        .expect({
          data: {
            instructions: {
              global: 'content',
              liquidity: { '0xMarketAddress:0xProvider:1': 'content' },
            },
            hash,
          },
        });
    });
  });
});
