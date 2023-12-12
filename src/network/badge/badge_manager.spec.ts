import * as moment from 'moment';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import Badge from '../../models/badge';
import BadgeGrant from '../../models/badge_grant';
import Liquidity from '../../models/liquidity';
import Market from '../../models/market';
import { toBN } from '../common';
import { BadgeManagerHandler } from './badge_manager.handler';

const BadgeManagerContract = jest.fn().mockImplementation(() => {
  return {};
});

const MockNetworkService = jest.fn().mockImplementation(() => {
  return {};
});

describe('BadgeManagerHandler', () => {
  const issuer = '0xIssuer';
  const issuerB = '0xIssuerB';
  const grantee = '0xGrantee';
  const badge = 'badge';
  const path = 'path';
  const keys = ['key1', 'key2'];
  const values = ['val1', 'val2'];
  const db = DBService.getForTest();
  const net = 'ethereum';
  let handler: BadgeManagerHandler;
  const badgeMgrContract = new BadgeManagerContract();
  const contracts = { core: badgeMgrContract };
  const cfg = {
    'app.badges.paymentMethod': 'pm',
    'app.badges.region': 'region',
  };

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    handler = new BadgeManagerHandler(new MockNetworkService(), null, net, contracts);
    handler.logger = new NoopLogger() as any;
    handler.getParam = (param) => {
      return cfg[param];
    };
    handler.cfg = {
      get: function (key) {
        return cfg[key];
      },
    } as any;
    await db.truncateTables();
  });

  describe('.onGrantedBadge', () => {
    it('should correctly create grant badge', async () => {
      const expireAt = moment().add(10, 's');
      await handler.onGrantedBadge('badge', 'path', grantee, keys, values, toBN(expireAt.unix()), null);
      const rec = await BadgeGrant.find({ badge, path });
      expect(rec).toBeDefined();
      expect(rec.grantee).toEqual(grantee);
      expect(rec.metadata).toEqual({ key1: 'val1', key2: 'val2' });
      expect(rec.expireAt).not.toBeNull();
    });

    it('should correctly create grant badge when expireAt is zero', async () => {
      await handler.onGrantedBadge('badge', 'path', grantee, keys, values, toBN(0), null);
      const rec = await BadgeGrant.find({ badge, path });
      expect(rec).toBeDefined();
      expect(rec.grantee).toEqual(grantee);
      expect(rec.metadata).toEqual({ key1: 'val1', key2: 'val2' });
      expect(rec.expireAt).toBeNull();
    });

    describe('when badge=pm and path is set', () => {
      it("should create badge grant record even when liquidity doesn't exist", async () => {
        await handler.onGrantedBadge('pm', 'bank_transfer', grantee, ['0xLiqAddress'], ['1'], toBN(0), null);
        const rec = await BadgeGrant.find({ badge: 'pm', path: 'bank_transfer' });
        expect(rec).toBeDefined();
      });

      it('should update payment method on liquidity matching the specified liquidity address in meta key array', async () => {
        let liq = await Liquidity.create({ network: net, address: '0xLiqAddress' });
        await handler.onGrantedBadge('pm', 'bank_transfer', grantee, ['0xLiqAddress'], ['1'], toBN(0), null);
        liq = await Liquidity.getById(liq.id);
        expect(liq.paymentMethods).toEqual(['pm/bank_transfer']);

        await handler.onGrantedBadge('pm', 'union_bank', grantee, ['0xLiqAddress'], ['1'], toBN(0), null);
        liq = await Liquidity.getById(liq.id);
        expect(liq.paymentMethods).toEqual(['pm/bank_transfer', 'pm/union_bank']);

        await handler.onGrantedBadge('pm', 'bank_transfer', grantee, ['0xLiqAddress'], ['0'], toBN(0), null);
        liq = await Liquidity.getById(liq.id);
        expect(liq.paymentMethods).toEqual(['pm/union_bank']);
      });
    });

    describe('when badge=region and path is set', () => {
      it("should create badge grant record even when market doesn't exist", async () => {
        await handler.onGrantedBadge('region', 'asia', '0xMarketAddress', [], [], toBN(0), null);
        const rec = await BadgeGrant.find({ badge: 'region', path: 'asia' });
        expect(rec).toBeDefined();
      });

      it('should update region on market matching the specified grantee address', async () => {
        let market = await Market.create({ network: net, address: '0xMarketAddress' });

        await handler.onGrantedBadge('region', 'asia', market.address, [], [], toBN(0), null);
        market = await Market.getById(market.id);
        expect(market.regions).toEqual(['region/asia']);

        // handle duplicate
        await handler.onGrantedBadge('region', 'asia', market.address, [], [], toBN(0), null);
        market = await Market.getById(market.id);
        expect(market.regions).toEqual(['region/asia']);

        // handle a new region
        await handler.onGrantedBadge('region', 'europe', market.address, [], [], toBN(0), null);
        market = await Market.getById(market.id);
        expect(market.regions).toEqual(['region/asia', 'region/europe']);
      });
    });
  });

  describe('.onRevokedBadge', () => {
    it('should revoke granted badge when path is unset', async () => {
      await handler.onGrantedBadge('badge', '', grantee, keys, values, toBN(0), null);
      let grant = await BadgeGrant.find({ badge, grantee });
      expect(grant).toBeDefined();

      await handler.onRevokedBadge(badge, '', grantee, null);
      grant = await BadgeGrant.find({ badge, path, grantee });
      expect(grant).toBeUndefined();
    });

    it('should revoke granted badge when path is set', async () => {
      await handler.onGrantedBadge('badge', '', grantee, keys, values, toBN(0), null);
      await handler.onGrantedBadge('badge', path, grantee, keys, values, toBN(0), null);
      let grant = await BadgeGrant.find({ badge, grantee, path });
      expect(grant).toBeDefined();

      await handler.onRevokedBadge(badge, path, grantee, null);
      grant = await BadgeGrant.find({ badge, path, grantee });
      expect(grant).toBeUndefined();
    });
  });

  describe('.onAddedIssuer', () => {
    it('should add a new badge issuer', async () => {
      await handler.onAddedIssuer(issuer, badge, keys, values, null);
      const rec = await Badge.find({ issuer, badge });
      expect(rec).toBeDefined();
      expect(rec.network).toEqual(net);
      expect(rec.metadata).toEqual({ key1: 'val1', key2: 'val2' });
    });
  });

  describe('.onReplacedIssuer', function () {
    it('should replace issuer', async () => {
      await handler.onAddedIssuer(issuer, badge, keys, values, null);
      let rec = await Badge.find({ issuer, badge });
      expect(rec).toBeDefined();
      expect(rec.issuer).toEqual(issuer);
      await handler.onReplacedIssuer(issuer, issuerB, badge, null);
      rec = await Badge.find({ issuer: issuerB, badge });
      expect(rec.issuer).toEqual(issuerB);
    });
  });

  describe('.onPathRegistered', function () {
    it('should add a new badge path', async () => {
      await handler.onPathRegistered(issuer, badge, path, keys, values, null);
      const rec = await Badge.find({ issuer, badge, path });
      expect(rec).toBeDefined();
      expect(rec.network).toEqual(net);
      expect(rec.path).toEqual(path);
      expect(rec.issuer).toEqual(issuer);
      expect(rec.metadata).toEqual({ key1: 'val1', key2: 'val2' });
    });
  });

  describe('.onAddedCoIssuer', function () {
    it('should add a co-issuer to a badge', async () => {
      await handler.onAddedIssuer(issuer, badge, keys, values, null);
      let rec = await Badge.find({ issuer, badge });
      expect(rec).toBeDefined();
      await handler.onAddedCoIssuer(issuer, issuerB, badge, null);
      rec = await Badge.find({ issuer, coIssuer: issuerB });
      expect(rec).toBeDefined();
    });
  });

  describe('.onRemovedCoIssuer', function () {
    it('should remove the co-issuer to a badge', async () => {
      await handler.onAddedIssuer(issuer, badge, keys, values, null);
      let rec = await Badge.find({ issuer, badge });
      expect(rec).toBeDefined();

      await handler.onAddedCoIssuer(issuer, issuerB, badge, null);
      rec = await Badge.find({ issuer, coIssuer: issuerB });
      expect(rec).toBeDefined();

      await handler.onRemovedCoIssuer(issuer, issuerB, badge, null);
      rec = await Badge.find({ issuer, coIssuer: issuerB });
      expect(rec).toBeUndefined();
    });
  });

  describe('.onBadgeMetaUpdated', function () {
    it('should correctly update the metadata when path is unset', async () => {
      await handler.onAddedIssuer(issuer, badge, keys, values, null);
      let rec = await Badge.find({ issuer, badge });
      expect(rec).toBeDefined();
      await handler.onBadgeMetaUpdated(issuer, badge, '', 'age', '100', null);
      rec = await Badge.find({ issuer, badge });
      expect(rec.metadata).toEqual({ key1: 'val1', key2: 'val2', age: '100' });
    });

    it('should correctly update the metadata when path is set', async () => {
      await handler.onAddedIssuer(issuer, badge, keys, values, null);
      await handler.onPathRegistered(issuer, badge, path, keys, values, null);
      let rec = await Badge.find({ issuer, badge, path });
      expect(rec).toBeDefined();

      await handler.onBadgeMetaUpdated(issuer, badge, path, 'age', '100', null);
      rec = await Badge.find({ issuer, badge, path });
      expect(rec.metadata).toEqual({ key1: 'val1', key2: 'val2', age: '100' });
    });
  });

  describe('.onGranteeBadgeMetaUpdated', function () {
    it('should update metadata correctly when path is unset', async () => {
      await handler.onGrantedBadge('badge', '', grantee, keys, values, toBN(0), null);
      let grant = await BadgeGrant.find({ badge, grantee });
      expect(grant).toBeDefined();
      expect(grant.metadata).toEqual({ key1: 'val1', key2: 'val2' });

      await handler.onGranteeBadgeMetaUpdated(issuer, grantee, badge, '', 'age', '100', null);
      grant = await BadgeGrant.find({ badge, grantee });
      expect(grant.metadata).toEqual({ key1: 'val1', key2: 'val2', age: '100' });
    });

    it('should update metadata correctly when path is set', async () => {
      await handler.onGrantedBadge('badge', path, grantee, keys, values, toBN(0), null);
      let grant = await BadgeGrant.find({ badge, grantee });
      expect(grant).toBeDefined();
      expect(grant.metadata).toEqual({ key1: 'val1', key2: 'val2' });

      await handler.onGranteeBadgeMetaUpdated(issuer, grantee, badge, path, 'age', '100', null);
      grant = await BadgeGrant.find({ badge, grantee });
      expect(grant.metadata).toEqual({ key1: 'val1', key2: 'val2', age: '100' });
    });

    describe('when badge=pm and path is set', () => {
      it('should update payment method on liquidity matching the specified liquidity address in meta key array', async () => {
        let liq = await Liquidity.create({ network: net, address: '0xLiqAddress' });
        await handler.onGrantedBadge('pm', 'bank_transfer', grantee, ['0xLiqAddress'], ['1'], toBN(0), null);
        liq = await Liquidity.getById(liq.id);
        expect(liq.paymentMethods).toEqual(['pm/bank_transfer']);

        await handler.onGranteeBadgeMetaUpdated(issuer, grantee, 'pm', 'bank_transfer', '0xLiqAddress', '0', null);
        liq = await Liquidity.getById(liq.id);
        expect(liq.paymentMethods).toEqual([]);

        await handler.onGranteeBadgeMetaUpdated(issuer, grantee, 'pm', 'bank_transfer', '0xLiqAddress', '1', null);
        liq = await Liquidity.getById(liq.id);
        expect(liq.paymentMethods).toEqual(['pm/bank_transfer']);
      });
    });
  });

  describe('.onBadgeOwnershipTransferred', function () {
    it('should update metadata correctly when path is unset', async () => {
      await handler.onAddedIssuer(issuer, badge, keys, values, null);
      let rec = await Badge.find({ issuer, badge });
      expect(rec).toBeDefined();

      await handler.onBadgeOwnershipTransferred(badge, '', issuer, issuerB, null);
      rec = await Badge.find({ badge, issuer: issuerB });
      expect(rec).toBeDefined();
    });

    it('should update metadata correctly when path is set', async () => {
      await handler.onAddedIssuer(issuer, badge, keys, values, null);
      let rec = await Badge.find({ issuer, badge });
      expect(rec).toBeDefined();

      await handler.onPathRegistered(issuer, badge, path, keys, values, null);
      rec = await Badge.find({ issuer, badge, path });
      expect(rec).toBeDefined();

      await handler.onBadgeOwnershipTransferred(badge, path, issuer, issuerB, null);
      rec = await Badge.find({ badge, path, issuer: issuerB });
      expect(rec).toBeDefined();
    });
  });
});
