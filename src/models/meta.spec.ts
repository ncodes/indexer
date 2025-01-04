import { ChainNames } from '@jointlabs/meta';
import { DBService } from '../db/db.service';
import Meta, { MetaKeys } from './meta';

describe('Market', () => {
  const db = DBService.getForTest();
  const net: ChainNames = 'ethereum';

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.truncateTables();
  });

  describe('.getDisputeDelayDur', () => {
    it('should return hardcoded duration 300 if no default or market-level configurations are set', async () => {
      const res = await Meta.getDisputeDelayDur(net, '0xMarketAddress');
      expect(res).toEqual(300);
    });

    it('should return the default duration if set', async () => {
      const res = await Meta.getDisputeDelayDur(net, '0xMarketAddress', '1000');
      expect(res).toEqual(1000);
    });

    it('should return the market-level duration if set', async () => {
      await Meta.updateJSON(net, MetaKeys.DisputeDelayDur, (obj) => {
        obj['0xMarketAddress'] = 1000;
      });
      const res = await Meta.getDisputeDelayDur(net, '0xMarketAddress');
      expect(res).toEqual(1000);
    });
  });
});
