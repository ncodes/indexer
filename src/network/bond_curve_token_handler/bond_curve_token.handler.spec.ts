import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import BondingCurveTx from '../../models/bonding_curve_tx';
import MerkleTree from '../../models/merkle_tree';
import Meta, { MetaKeys } from '../../models/meta';
import { BondCurveTokenHandler } from './bond_curve_token.handler';

const MockNetworkService = jest.fn().mockImplementation(() => {
  return {};
});

describe('BondCurveTokenHandler', () => {
  const db = DBService.getForTest();
  const net = 'ethereum';
  let handler: BondCurveTokenHandler;
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
    handler = new BondCurveTokenHandler(new MockNetworkService(), net, contracts);
    handler.logger = new NoopLogger() as any;
    handler.getParam = (param) => {
      return cfg[param];
    };

    await Meta.create(Meta.makeNetKey(net, MetaKeys.ContractsParams), JSON.stringify({} as ContractsParams));
  });

  describe('.onBuy', () => {
    it('should create a bonding curve tx and reset buyer claim with id 0', async () => {
      await MerkleTree.create({
        address: '0x123',
        claimId: 0,
        claimedAt: new Date().toISOString(),
      });

      const buyer = '0x123';
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

      const existingClaim = await MerkleTree.findByAddressAndClaimId(buyer, 0);
      expect(existingClaim).not.toBeNull();
      expect(existingClaim.claimedAt).toBeNull();
    });
  });
});
