import { Test, TestingModule } from '@nestjs/testing';
import NetworkService from '../../network/network.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
  let service: PaymentsService;
  let cfgObj = {};
  const net = 'ethereum';
  const grantee = '0x34e1dbE20d78C573bC49BBB37b26De744B6D9D15';
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

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('.getPaymentMethodGrantSignature', () => {
    it(`should throw error when badge format is invalid`, async () => {
      await expect(
        service.getPaymentMethodGrantSignature(net, 'badge', '0xUser', '0xLiqAddres', '1'),
      ).rejects.toThrowError('invalid payment method badge path');
    });

    describe('when badge did not exist', () => {
      it('should return correct signature info', async () => {
        mockHasBadge.mockResolvedValue(false);
        const sigInfo = await service.getPaymentMethodGrantSignature(net, 'badge/path', grantee, '0xLiqAddress', '1');
        expect(sigInfo.isNew).toBeTruthy();
        expect(sigInfo.sig).toBeDefined();
        expect(sigInfo.values).toHaveLength(7);
        expect(sigInfo.values[0]).toEqual('badge');
        expect(sigInfo.values[1]).toEqual('path');
        expect(sigInfo.values[2]).toEqual(grantee);
        expect(sigInfo.values[3]).toEqual(0);
        expect(sigInfo.values[4]).toEqual(['0xLiqAddress']);
        expect(sigInfo.values[5]).toEqual(['1']);
        expect(sigInfo.values[6]).toBeDefined();
      });
    });

    describe('when badge exists', () => {
      it('should return correct signature info', async () => {
        mockHasBadge.mockResolvedValue(true);
        const sigInfo = await service.getPaymentMethodGrantSignature(net, 'badge/path', grantee, '0xLiqAddress', '1');
        expect(sigInfo.isNew).toBeFalsy();
        expect(sigInfo.sig).toBeDefined();
        expect(sigInfo.values).toHaveLength(6);
        expect(sigInfo.values[0]).toEqual('badge');
        expect(sigInfo.values[1]).toEqual('path');
        expect(sigInfo.values[2]).toEqual(grantee);
        expect(sigInfo.values[3]).toEqual('0xLiqAddress');
        expect(sigInfo.values[4]).toEqual('1');
        expect(sigInfo.values[5]).toBeDefined();
      });
    });
  });
});
