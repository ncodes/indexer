import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat } from 'viem/chains';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { CommonValidationPipeOpt } from '../../common/pipes/common.pipe';
import { DBService } from '../../db/db.service';
import Point, { PointAction } from '../../models/point';
import { powOf } from '../../network/common';
import NetworkService from '../../network/network.service';
import { PointController } from './point.controller';
import { PointService } from './point.service';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

const mockBalanceOf = jest.fn();
const NetworkServiceMock = jest.fn().mockImplementation(() => {
  return {
    getContracts: () => {
      return {
        energon: {
          balanceOf: mockBalanceOf,
        },
      };
    },
  };
});

jest.mock('axios', () => ({
  default: jest.fn().mockResolvedValue({
    data: `Wallet Address,Address Type,Point,Ranking
0x80c4ae58e8c425b54c31e958a3edc32776f09de9,EVM,5,1
0x80c4ae58e8c425b54c31e958a3edc32776f09de8,EVM,50,1
    `,
  }),
}));

describe('PointController', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let cfgObj: Record<string, string> = {};
  const pointsPerEng = '10';

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

    cfgObj = {
      'auth.jwtSecret': 'secret_secret',
      'app.rootAdminUser': 'test',
      'app.rootAdminPass': 'test',
      'app.pointsPerEnergon': pointsPerEng,
      'app.network': 'ethereum',
    };
    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      controllers: [PointController],
      providers: [ConfigService, PointService, NetworkService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(NetworkService)
      .useValue(new NetworkServiceMock())
      .compile();
    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(new ValidationPipe(CommonValidationPipeOpt));
    await app.init();
  });

  describe('.getLeaderboard', () => {
    it('should return empty result when no point has been created', async () => {
      await request(app.getHttpServer())
        .get(`/v1/points/leaderboard`)
        .send({})
        .expect(200)
        .expect({ data: { points: [], total: 0 } });
    });

    it('should return correct results when two different users have points', async () => {
      const p1 = await Point.create({
        network: 'ethereum',
        name: 'point_1',
        address: '0xAddress',
        point: '200',
        action: PointAction.Generic,
      });

      const p2 = await Point.create({
        network: 'ethereum',
        name: 'point_2',
        address: '0xAddress2',
        point: '100',
        action: PointAction.Generic,
      });

      await request(app.getHttpServer())
        .get(`/v1/points/leaderboard`)
        .send({})
        .expect(200)
        .expect((res) => {
          expect(res.body.data.total).toBe(2);
          expect(res.body.data.points.length).toBe(2);
          expect(p1.address).toBe(res.body.data.points[0].address);
          expect(p2.address).toBe(res.body.data.points[1].address);
          expect(p1.point).toBe(res.body.data.points[0].totalPoints);
          expect(p2.point).toBe(res.body.data.points[1].totalPoints);
        });
    });

    it('should return correct results when a user has multiple points', async () => {
      const p1 = await Point.create({
        network: 'ethereum',
        name: 'point_1',
        address: '0xAddress',
        point: '200',
        action: PointAction.Generic,
      });

      await Point.create({
        network: 'ethereum',
        name: 'point_2',
        address: '0xAddress',
        point: '100',
        action: PointAction.Generic,
      });

      await request(app.getHttpServer())
        .get(`/v1/points/leaderboard`)
        .send({})
        .expect(200)
        .expect((res) => {
          expect(res.body.data.total).toBe(1);
          expect(res.body.data.points.length).toBe(1);
          expect(p1.address).toBe(res.body.data.points[0].address);
          expect('300').toBe(res.body.data.points[0].totalPoints);
        });
    });

    it('should return correct results when address query is provided', async () => {
      const p1 = await Point.create({
        network: 'ethereum',
        name: 'point_1',
        address: '0xAddress',
        point: '200',
        action: PointAction.Generic,
      });

      await Point.create({
        network: 'ethereum',
        name: 'point_2',
        address: '0xAddress2',
        point: '100',
        action: PointAction.Generic,
      });

      await request(app.getHttpServer())
        .get(`/v1/points/leaderboard`)
        .query({ address: '0xAddress' })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.total).toBe(1);
          expect(res.body.data.points.length).toBe(1);
          expect(p1.address).toBe(res.body.data.points[0].address);
          expect(res.body.data.points[0].rank).toBe(1);
        });
    });

    it('should return correct results when limit query is provided', async () => {
      const p1 = await Point.create({
        network: 'ethereum',
        name: 'point_1',
        address: '0xAddress',
        point: '200',
        action: PointAction.Generic,
      });

      await Point.create({
        network: 'ethereum',
        name: 'point_2',
        address: '0xAddress2',
        point: '100',
        action: PointAction.Generic,
      });

      await request(app.getHttpServer())
        .get(`/v1/points/leaderboard`)
        .query({ limit: 1 })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.total).toBe(2);
          expect(res.body.data.points.length).toBe(1);
          expect(p1.address).toBe(res.body.data.points[0].address);
        });
    });
  });

  describe('.createPointsFromCSV', () => {
    it('should return 401 when basic authorization fails', async () => {
      await request(app.getHttpServer())
        .post(`/v1/points/from-csv`)
        .send({})
        .expect(401)
        .expect({
          error: {
            type: 'authentication_error',
            message: 'authorization header is required',
          },
        });
    });

    it('should return 400 when csv url was not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/points/from-csv`)
        .auth('test', 'test')
        .send({})
        .expect(400)
        .expect({
          error: {
            message: 'csv url is required',
            param: 'csvUrl',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return 400 x', async () => {
      await request(app.getHttpServer())
        .post(`/v1/points/from-csv`)
        .auth('test', 'test')
        .send({ csvUrl: 'https://example.com' })
        .expect(201)
        .expect({ data: { ok: true } });

      const p = await Point.query().where('address', '0x80c4ae58e8c425b54c31e958a3edc32776f09de9').first();
      expect(p).toBeDefined();
      expect(p.point).toBe('5');

      const p2 = await Point.query().where('address', '0x80c4ae58e8c425b54c31e958a3edc32776f09de8').first();
      expect(p2).toBeDefined();
      expect(p2.point).toBe('50');
    });
  });

  describe('.createPointFromEnergonBalance', () => {
    it('should return error beneficiary address was not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/points/from-energon-balance`)
        .send({})
        .expect(400)
        .expect({
          error: {
            message: 'beneficiary address is required',
            param: 'beneficiary',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return error signer address was not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/points/from-energon-balance`)
        .send({
          beneficiary: '0xBeneficiary',
        })
        .expect(400)
        .expect({
          error: {
            message: 'signer address is required',
            param: 'signer',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return error signature was not provided', async () => {
      await request(app.getHttpServer())
        .post(`/v1/points/from-energon-balance`)
        .send({
          beneficiary: '0xBeneficiary',
          signer: '0xSigner',
        })
        .expect(400)
        .expect({
          error: {
            message: 'signature is required',
            param: 'sig',
            type: 'invalid_request_error',
          },
        });
    });

    it('should return error signature is invalid', async () => {
      await request(app.getHttpServer())
        .post(`/v1/points/from-energon-balance`)
        .send({
          beneficiary: '0xBeneficiary',
          signer: '0xSigner',
          sig: '0xSignature',
        })
        .expect(400)
        .expect({
          error: { type: 'invalid_request_error', message: 'invalid signature' },
        });
    });

    it('should return error signature is invalid when signer did not sign the signature', async () => {
      const walletClient = createWalletClient({
        account: privateKeyToAccount('0x0123456789012345678901234567890123456789012345678901234567890123'),
        chain: hardhat,
        transport: http(),
      });
      const sig = await walletClient.signMessage({ message: `beneficiary: 0xBeneficiary` } as any);

      await request(app.getHttpServer())
        .post(`/v1/points/from-energon-balance`)
        .send({
          beneficiary: '0xBeneficiary',
          signer: '0xSigner',
          sig,
        })
        .expect(400)
        .expect({
          error: { type: 'invalid_request_error', message: 'invalid signature' },
        });
    });

    it('should successfully create correct point', async () => {
      const walletClient = createWalletClient({
        account: privateKeyToAccount('0x0123456789012345678901234567890123456789012345678901234567890123'),
        chain: hardhat,
        transport: http(),
      });
      const sig = await walletClient.signMessage({ message: `beneficiary: 0xBeneficiary` } as any);

      mockBalanceOf.mockResolvedValueOnce(powOf(1000, 18));

      await request(app.getHttpServer())
        .post(`/v1/points/from-energon-balance`)
        .send({
          beneficiary: '0xBeneficiary',
          signer: walletClient.account.address,
          sig,
        })
        .expect(201)
        .expect({
          data: { ok: true },
        });

      const point = await Point.getByName(`energon_point:${walletClient.account.address}`);
      expect(point).toBeDefined();
      expect(point.point).toBe('10000');
      expect(point.address).toBe('0xBeneficiary');
      expect(point.action).toBe(PointAction.Energon);
      expect(point.network).toBe('ethereum');
    });

    it('should return error if point has already been created for signer', async () => {
      const walletClient = createWalletClient({
        account: privateKeyToAccount('0x0123456789012345678901234567890123456789012345678901234567890123'),
        chain: hardhat,
        transport: http(),
      });
      const sig = await walletClient.signMessage({ message: `beneficiary: 0xBeneficiary` } as any);

      mockBalanceOf.mockResolvedValueOnce(powOf(1000, 18));

      await request(app.getHttpServer())
        .post(`/v1/points/from-energon-balance`)
        .send({
          beneficiary: '0xBeneficiary',
          signer: walletClient.account.address,
          sig,
        })
        .expect(201)
        .expect({
          data: { ok: true },
        });

      const point = await Point.getByName(`energon_point:${walletClient.account.address}`);
      expect(point).toBeDefined();

      await request(app.getHttpServer())
        .post(`/v1/points/from-energon-balance`)
        .send({
          beneficiary: '0xBeneficiary',
          signer: walletClient.account.address,
          sig,
        })
        .expect(400)
        .expect({
          error: { type: 'invalid_request_error', message: 'points already granted' },
        });
    });
  });

  describe('.getLatestPoints', () => {
    it("should return error when 'from' is invalid", async () => {
      await request(app.getHttpServer())
        .get(`/v1/points/latest`)
        .query({ from: 'invalid' })
        .expect(400)
        .expect({
          error: {
            message: 'must be a valid ISO8601 date',
            param: 'from',
            type: 'invalid_request_error',
          },
        });
    });

    it("should return correct results when 'from' is valid", async () => {
      const p1 = await Point.create({
        network: 'ethereum',
        name: 'point_1',
        address: '0xAddress',
        point: '200',
        action: PointAction.Generic,
        createdAt: '2021-01-01T00:00:00Z',
      });

      const p2 = await Point.create({
        network: 'ethereum',
        name: 'point_2',
        address: '0xAddress2',
        point: '100',
        action: PointAction.Generic,
        createdAt: '2021-01-02T00:00:00Z',
      });

      await request(app.getHttpServer())
        .get(`/v1/points/latest`)
        .query({ from: '2021-01-02T00:00:00Z' })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBe(0);
        });

      await request(app.getHttpServer())
        .get(`/v1/points/latest`)
        .query({ from: '2021-01-01T00:00:00Z' })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBe(1);
          expect(p2.address).toBe(res.body.data[0].address);
        });

      await request(app.getHttpServer())
        .get(`/v1/points/latest`)
        .query({})
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBe(2);
          expect(p2.address).toBe(res.body.data[0].address);
          expect(p1.address).toBe(res.body.data[1].address);
        });
    });
  });

  describe('.isPointExistByName', () => {
    it('should return true when point exists', async () => {
      const p = await Point.create({
        network: 'ethereum',
        name: 'point_1',
        address: '0xAddress',
        point: '200',
        action: PointAction.Generic,
      });

      await request(app.getHttpServer())
        .get(`/v1/points/${p.name}/exist`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.exist).toBe(true);
        });
    });

    it('should return false when point does not exist', async () => {
      await request(app.getHttpServer())
        .get(`/v1/points/point_1/exist`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.exist).toBe(false);
        });
    });
  });
});
