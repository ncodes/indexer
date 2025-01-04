import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import NetworkService from '../../network/network.service';
import { PaymentsService } from './payments.service';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

const mockHasBadge = jest.fn();
const NetworkServiceMock = jest.fn().mockImplementation(() => {
  return {
    getContracts: jest.fn().mockReturnValue({
      badgeMgr: {
        hasBadge: mockHasBadge,
      },
    }),
  };
});

describe('PaymentsService', () => {
  let module: TestingModule;
  let cfgObj = {};
  const pkIssuer = '0x1ef7f782225033ac48a22437dfff4c6ad78f28e69a421d0875b9b76c89e6f068';

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCfgGet.mockReset();

    cfgObj = {
      'app.badges.paymentMethodIssuerPk': pkIssuer,
    };

    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      providers: [NetworkService, ConfigService, PaymentsService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(NetworkService)
      .useValue(new NetworkServiceMock())
      .compile();

    module.get<PaymentsService>(PaymentsService);
  });

  describe('.getPaymentMethodGrantSignature', () => {
    it(`should throw error when badge format is invalid`, async () => {
      //
    });
  });
});
