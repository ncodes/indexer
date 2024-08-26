import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import { toBigInt } from '../common';
import { ProviderRegistryHandler } from './provider_registry.handler';
import ProviderRegistry from '../../models/provider_registry';

const MockNetworkService = jest.fn().mockImplementation(() => {
  return {};
});

describe('ProviderRegistryHandler', () => {
  const db = DBService.getForTest();
  const net = 'ethereum';
  const provider = '0xProvider';
  let handler: ProviderRegistryHandler;
  const contracts = {};
  const cfg = {};

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    handler = new ProviderRegistryHandler(new MockNetworkService(), net, contracts);
    handler.logger = new NoopLogger() as any;
    handler.getParam = (param) => {
      return cfg[param];
    };
    await db.truncateTables();
  });

  describe('.onProviderRegistered', () => {
    it('should correctly update asset information', async () => {
      await expect(handler.onProviderRegistered(provider, toBigInt(1), undefined)).resolves.toBeUndefined();
      let res = await ProviderRegistry.getByNetworkAndAddress(net, provider);
      expect(res).toBeDefined();
      expect(res.index).toEqual(1);

      // should not update if already exists
      await expect(handler.onProviderRegistered(provider, toBigInt(1), undefined)).resolves.toBeUndefined();
      res = await ProviderRegistry.getByNetworkAndAddress(net, provider);
      expect(res).toBeDefined();
      expect(res.index).toEqual(1);
    });
  });
});
