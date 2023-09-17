import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InstructionsService } from './instructions.service';
import NetworkService from '../network/network.service';

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

describe('InstructionsService', () => {
  let module: TestingModule;
  let service: InstructionsService;
  let cfgObj = {};
  const net = 'ethereum';
  const grantee = '0x34e1dbE20d78C573bC49BBB37b26De744B6D9D15';
  const pkIssuer = '0x1ef7f782225033ac48a22437dfff4c6ad78f28e69a421d0875b9b76c89e6f068';

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCfgGet.mockReset();

    cfgObj = {
      'app.badges.instruction': 'instruction',
      'app.badges.instructionIssuerPk': pkIssuer,
    };

    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      providers: [NetworkService, ConfigService, InstructionsService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(NetworkService)
      .useValue(new NetworkServiceMock())
      .compile();

    service = module.get<InstructionsService>(InstructionsService);
  });

  describe('.getGrantSignature', () => {
    it('should return correct signature info', async () => {
      mockHasBadge.mockResolvedValue(false);
      const sigInfo = await service.getGrantSignature(net, grantee, '0xHash');
      expect(sigInfo.isNew).toBeTruthy();
      expect(sigInfo.sig).toBeDefined();
      expect(sigInfo.values).toHaveLength(7);
      expect(sigInfo.values[0]).toEqual('instruction');
      expect(sigInfo.values[1]).toEqual('');
      expect(sigInfo.values[2]).toEqual(grantee);
      expect(sigInfo.values[3]).toEqual(0);
      expect(sigInfo.values[4]).toEqual(['hash']);
      expect(sigInfo.values[5]).toEqual(['0xHash']);
      expect(sigInfo.values[6]).toBeDefined();
    });

    describe('when badge exists', () => {
      it('should return correct signature info', async () => {
        mockHasBadge.mockResolvedValue(true);
        const sigInfo = await service.getGrantSignature(net, grantee, '0xHash');
        expect(sigInfo.isNew).toBeFalsy();
        expect(sigInfo.sig).toBeDefined();
        expect(sigInfo.values).toHaveLength(6);
        expect(sigInfo.values[0]).toEqual('instruction');
        expect(sigInfo.values[1]).toEqual('');
        expect(sigInfo.values[2]).toEqual(grantee);
        expect(sigInfo.values[3]).toEqual('hash');
        expect(sigInfo.values[4]).toEqual('0xHash');
        expect(sigInfo.values[5]).toBeDefined();
      });
    });
  });
});
