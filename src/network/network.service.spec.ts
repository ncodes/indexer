import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DBService } from '../db/DBService';
import { NotifierService } from '../jobs/mailer/NotifierService';
import { ExchangeRateService } from '../services/exchange_rate.service';
import { MetadataService } from '../services/metadata/metadata.service';
import { RedisService } from '../services/redis.service';
import NetworkService from './network.service';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

const mockNotify = jest.fn();
const MockNotifierService = jest.fn().mockImplementation(() => {
  return { notify: mockNotify };
});

describe('NetworkService', () => {
  let module: TestingModule;
  const db = DBService.getForTest();
  let cfgObj = {};

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
    mockCfgGet.mockReset();
    mockNotify.mockReset();

    cfgObj = {};
    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      providers: [NetworkService, NotifierService, ConfigService, MetadataService, ExchangeRateService, RedisService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(NotifierService)
      .useValue(new MockNotifierService())
      .overrideProvider(RedisService)
      .useValue(new (jest.fn())())
      .compile();

    module.get<NetworkService>(NetworkService);
  });

  it('no-op', function () {
    //
  });
});
