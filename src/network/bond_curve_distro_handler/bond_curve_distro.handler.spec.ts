import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import BondingCurveTx from '../../models/bonding_curve_tx';
import Meta, { MetaKeys } from '../../models/meta';
import TokenClaim from '../../models/token_claim';
import { BondCurveDistroHandler } from './bond_curve_distro.handler';

const MockNetworkService = jest.fn().mockImplementation(() => {
  return {
    cfgSrv: new MockConfigService(),
  };
});

const mockGet = jest.fn();
const MockConfigService = jest.fn().mockImplementation(() => {
  return {
    get: mockGet,
  };
});

describe('BondCurveDistroHandler', () => {
  const db = DBService.getForTest();
  const net = 'ethereum';
  let handler: BondCurveDistroHandler;
  const contracts = {};
  const cfg = {
    'app.claimResetMinSpend': '0',
  };

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    handler = new BondCurveDistroHandler(new MockNetworkService(), undefined, net, contracts);
    handler.logger = new NoopLogger() as any;
    handler.getParam = (param) => {
      return cfg[param];
    };

    mockGet.mockImplementation((param) => {
      return cfg[param];
    });

    await Meta.create(Meta.makeNetKey(net, MetaKeys.ContractsParams), JSON.stringify({} as ContractsParams));
  });

  describe('.onBuy', () => {
    it('should create a bonding curve tx and reset buyer claim with id 0', async () => {
      cfg['app.claimResetMinSpend'] = '100';
      cfg['app.claimSigner'] = '0x91c9a4944358a462f016b77c74bd8f651034cce0c7fcce7523d1577cfc1b88ce';

      await TokenClaim.create({
        address: '0x997315B9DE74A170d64a7c271D47502a38cEF7d3',
        claimId: 0,
        claimedAt: new Date().toISOString(),
      });

      const buyer = '0x997315B9DE74A170d64a7c271D47502a38cEF7d3';
      const inAmt = 100;
      const outAmt = 90;
      const fee = 10;
      await handler.onBuy(buyer, BigInt(inAmt), BigInt(outAmt), BigInt(fee), {} as any);

      const tx = await BondingCurveTx.find({ address: buyer });
      expect(tx).not.toBeNull();
      expect(tx.buy).toBe(true);
      expect(tx.input).toBe(inAmt.toString());
      expect(tx.output).toBe(outAmt.toString());
      expect(tx.fee).toBe(fee.toString());

      const existingClaim = await TokenClaim.findByAddressAndClaimId(buyer, 0);
      expect(existingClaim).not.toBeNull();
      expect(existingClaim.claimedAt).toBeNull();
    });
  });
});
