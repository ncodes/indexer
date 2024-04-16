import * as moment from 'moment';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import Meta, { MetaKeys } from '../../models/meta';
import Miner from '../../models/miner';
import MinerReward from '../../models/miner_reward';
import MinerSlash from '../../models/miner_slash';
import { toBigInt } from '../common';
import { MinerRegistryHandler, MinerRewardOpName } from './miner_registry.handler';

const MockNetworkService = jest.fn().mockImplementation(() => {
  return {};
});

describe('AssetRegistryHandler', () => {
  const db = DBService.getForTest();
  const net = 'ethereum';
  let handler: MinerRegistryHandler;
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
    handler = new MinerRegistryHandler(new MockNetworkService(), net, contracts);
    handler.logger = new NoopLogger() as any;
    handler.getParam = (param) => {
      return cfg[param];
    };

    await Meta.create(Meta.makeNetKey(net, MetaKeys.ContractsParams), JSON.stringify({} as ContractsParams));
  });

  describe('.onParameterUpdate', function () {
    it('should throw error if contract params metadata has not been initialized', async () => {
      const key = Meta.makeNetKey(net, MetaKeys.ContractsParams);
      await Meta.update(key, '');
      await expect(handler.onParameterUpdate('minerBond', '1', {} as any)).rejects.toThrow(
        'Contracts params not initialized',
      );
    });

    it('should update contract params correctly', async () => {
      await expect(handler.onParameterUpdate('minerBond', '1', {} as any)).resolves.toBeUndefined();
      const value = await Meta.getContractParam(net, 'minerBond');
      expect(value).toEqual('1');
    });
  });

  describe('.onRegistered', () => {
    describe('new miner', () => {
      it('should create miner record', async () => {
        cfg['minerMatureDur'] = 1600;

        const now = moment().unix();
        const evt = { getBlock: jest.fn().mockResolvedValue({ timestamp: now }) } as any;
        await expect(handler.onRegistered('0xAddress', toBigInt(100), evt)).resolves.toBeUndefined();

        const miner = await Miner.find({ address: '0xAddress' });
        expect(miner).toBeDefined();
        expect(miner.bond).toEqual('100');
        expect(moment(miner.maturedAt).unix()).toEqual(now + 1600);
      });
    });

    describe('returning miner (previously drained)', () => {
      it('should create miner record', async () => {
        cfg['minerMatureDur'] = 1600;

        let miner = await Miner.create({
          network: net,
          address: '0xAddress',
          bond: '0',
          cancelling: true,
          cancelledAt: moment().toISOString(),
          drained: true,
        });

        const now = moment().unix();
        const evt = { getBlock: jest.fn().mockResolvedValue({ timestamp: now }) } as any;
        await expect(handler.onRegistered('0xAddress', toBigInt(100), evt)).resolves.toBeUndefined();

        miner = await Miner.find({ address: '0xAddress' });
        expect(miner).toBeDefined();
        expect(miner.bond).toEqual('100');
        expect(moment(miner.maturedAt).unix()).toEqual(now + 1600);
        expect(miner.drained).toBeFalsy();
        expect(miner.cancelling).toBeFalsy();
        expect(miner.cancelledAt).toBeNull();
      });
    });
  });

  describe('.onCancelled', () => {
    it('should mark miner as cancelling', async () => {
      const now = moment().unix();
      const evt = { getBlock: jest.fn().mockResolvedValue({ timestamp: now }) } as any;
      const cancelDur = 86400;

      await Miner.create({
        network: net,
        address: '0xAddress',
        bond: '100',
      });

      await expect(handler.onCancelled('0xAddress', toBigInt(cancelDur), evt)).resolves.toBeUndefined();
      const miner = await Miner.find({ address: '0xAddress' });
      expect(miner).toBeDefined();
      expect(miner.cancelling).toBeTruthy();
      expect(moment(miner.cancelledAt).unix()).toEqual(now + cancelDur);
    });
  });

  describe('.onDrained', () => {
    it('should mark miner as cancelling', async () => {
      const now = moment().unix();
      const evt = { getBlock: jest.fn().mockResolvedValue({ timestamp: now }) } as any;
      const amount = 100;

      await Miner.create({
        network: net,
        address: '0xAddress',
        bond: '100',
        maturedAt: moment().toISOString(),
        cancelling: true,
        cancelledAt: moment().toISOString(),
        drained: false,
      });

      await expect(handler.onDrained('0xAddress', toBigInt(amount), evt)).resolves.toBeUndefined();
      const miner = await Miner.find({ address: '0xAddress' });
      expect(miner).toBeDefined();
      expect(miner.cancelling).toBeTruthy();
      expect(miner.cancelledAt).toBeDefined();
      expect(miner.maturedAt).toBeDefined();
      expect(miner.drained).toBeTruthy();
      expect(miner.bond).toEqual('0');
    });
  });

  describe('.onBlocked', () => {
    it('should mark miner as cancelling', async () => {
      let miner = await Miner.create({
        network: net,
        address: '0xAddress',
        blocked: false,
      });

      await expect(handler.onBlocked('0xAddress', true, {} as any)).resolves.toBeUndefined();
      miner = await Miner.getById(miner.id);
      expect(miner.blocked).toBeTruthy();

      await expect(handler.onBlocked('0xAddress', false, {} as any)).resolves.toBeUndefined();
      miner = await Miner.getById(miner.id);
      expect(miner.blocked).toBeFalsy();
    });
  });

  describe('.onSlashed', () => {
    it('should create slash record', async () => {
      await expect(handler.onSlashed('0xAddress', toBigInt(1000), {} as any)).resolves.toBeUndefined();
      const slash = await MinerSlash.find({ address: '0xAddress' });
      expect(slash).toBeDefined();
      expect(slash.amount).toEqual('1000');
      expect(slash.network).toEqual(net);
    });
  });

  describe('.onRewardAdded', () => {
    it('should create reward record', async () => {
      await expect(handler.onRewardAdded('0xAddress', toBigInt(0), toBigInt(1000), {} as any)).resolves.toBeUndefined();
      const reward = await MinerReward.find({ address: '0xAddress', operation: MinerRewardOpName[0] });
      expect(reward).toBeDefined();
      expect(reward.amount).toEqual('1000');
      expect(reward.network).toEqual(net);
    });
  });
});
