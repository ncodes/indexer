import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import Meta, { MetaKeys } from '../../models/meta';
import PayRouterRequest from '../../models/pay_router_request';
import { MarketManagerHandler } from './market_manager.handler';

const MockNetworkService = jest.fn().mockImplementation(() => {
  return {};
});

describe('MarketManagerHandler', () => {
  const db = DBService.getForTest();
  const net = 'ethereum';
  let handler: MarketManagerHandler;
  const contracts = {};
  const cfg = {};

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.truncateTables();

    jest.clearAllMocks();
    handler = new MarketManagerHandler(new MockNetworkService(), net, contracts);
    handler.logger = new NoopLogger() as any;
    handler.getParam = (param) => {
      return cfg[param];
    };

    await Meta.create(
      Meta.makeNetKey(net, MetaKeys.ContractsParams),
      JSON.stringify({
        payRouterProtocolFeeBp: 1000,
      }),
    );
  });

  describe('.onRequestCreated', function () {
    it('should update the PayRouter request orderId field', async () => {
      const request = await PayRouterRequest.create({ network: net, requestId: 1 });

      await expect(
        handler.onRequestCreated(BigInt(request.requestId), BigInt(100), {} as any),
      ).resolves.toBeUndefined();

      const updatedRequest = await PayRouterRequest.getById(request.id);
      expect(updatedRequest.orderId).toEqual(100);
    });
  });
});
