import { DBService } from '../../db/DBService';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { toBN } from '../common';
import BadgeGrant from '../../models/badge_grant';
import * as moment from 'moment';
import Badge from '../../models/badge';
import { AssetRegistryHandler } from './asset_registry.handler';
import AssetRegistry from '../../models/asset_registry';

const BadgeManagerContract = jest.fn().mockImplementation(() => {
  return {};
});

const MockNetworkService = jest.fn().mockImplementation(() => {
  return {};
});

describe('AssetRegistryHandler', () => {
  const db = DBService.getForTest();
  const net = 'ethereum';
  const asset = '0xAsset';
  const asset2 = '0xAsset2';
  let handler: AssetRegistryHandler;
  const badgeMgrContract = new BadgeManagerContract();
  const contracts = { core: badgeMgrContract };
  const cfg = {};

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    handler = new AssetRegistryHandler(new MockNetworkService(), net, contracts);
    handler.logger = new NoopLogger() as any;
    handler.getParam = (param) => {
      return cfg[param];
    };
    await db.truncateTables();
  });

  describe('.onAssetRegistryUpdated', () => {
    it('should correctly update asset information', async () => {
      await AssetRegistry.create({
        network: net,
        address: asset2,
      });
      await AssetRegistry.create({
        network: net,
        address: asset,
        curRate: '200',
        feeBp: 100,
        feeFixed: '100',
        amountPerRewardPoint: '1000',
        sharable: false,
        stable: true,
        verified: false,
      });
      await expect(
        handler.onAssetRegistryUpdated(
          asset,
          toBN(300),
          toBN(150),
          toBN(200),
          toBN(2000),
          true,
          false,
          true,
          null,
        ),
      ).resolves.toBeUndefined();
      const res = await AssetRegistry.find({ network: net, address: asset });
      expect(res.curRate).toEqual('300');
      expect(res.feeBp).toEqual(150);
      expect(res.feeFixed).toEqual('200');
      expect(res.amountPerRewardPoint).toEqual('2000');
      expect(res.verified).toEqual(true);
      expect(res.stable).toEqual(false);
      expect(res.sharable).toEqual(true);
      expect(await AssetRegistry.find({ network: net, address: asset2 })).toBeDefined();
    });
  });
});
