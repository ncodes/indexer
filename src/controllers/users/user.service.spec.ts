import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DBService } from '../../db/DBService';
import { UserService } from './user.service';
import Market, { AssetType } from '../../models/market';
import { MarketService } from '../markets/market.service';
import Swap from '../../models/swap';
import * as moment from 'moment';
import { MetadataService } from '../../services/metadata/metadata.service';
import { RedisService } from '../../services/redis.service';
import User from '../../models/user';
import BadgeGrant from '../../models/badge_grant';

const mockTryToUsd = jest.fn();
const MetadataServiceMock = jest.fn().mockImplementation(() => {
  return {
    tryToUsd: mockTryToUsd,
  };
});

describe('UserService', () => {
  let module: TestingModule;
  let service: UserService;
  const db = DBService.getForTest();
  const net = 'ethereum';
  const marketAddress = '0xMarket';
  const user = '0xUser';
  const user2 = '0xUser2';

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.truncateTables();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      providers: [UserService, MarketService, MetadataService, RedisService],
    })
      .overrideProvider(MetadataService)
      .useValue(new MetadataServiceMock())
      .overrideProvider(RedisService)
      .useValue(new (jest.fn())())
      .compile();

    service = module.get<UserService>(UserService);
  });

  describe('.extendUser', () => {
    let market: Market;
    let u: User;
    let u2: User;

    beforeEach(async () => {
      u = await User.create({ address: user });
      u2 = await User.create({ address: user2 });
      market = await Market.create({
        address: marketAddress,
        network: net,
      });
    });

    it(`should calculate correct 'totalSwap'`, async () => {
      await Swap.create({ network: net, marketAddress, provider: user });
      await Swap.create({ network: net, marketAddress, taker: user });
      await Swap.create({ network: net, marketAddress, provider: user, cancelled: true });
      await expect(service.extendUser(u, net)).resolves.toBeUndefined();
      expect(u.totalSwaps).toEqual(2);
    });

    it(`should calculate correct 'completionRate'`, async () => {
      await Swap.create({ network: net, marketAddress, provider: user, cancelled: true });
      await Swap.create({ network: net, marketAddress, taker: user, released: true });
      await Swap.create({ network: net, marketAddress, provider: user, byDispute: true, released: true });
      await expect(service.extendUser(u, net)).resolves.toBeUndefined();
      expect(u.completionRate).toEqual(33.33);
    });

    it(`should calculate correct 'completionRate'`, async () => {
      await BadgeGrant.create({ network: net, grantee: user, badge: 'badge1' });
      await BadgeGrant.create({ network: net, grantee: user, badge: 'badge1', path: 'path1' });
      await expect(service.extendUser(u, net)).resolves.toBeUndefined();
      expect(u.badges).toEqual(['badge1/path1', 'badge1']);
    });

    it(`should calculate correct 'volume'`, async () => {
      await Swap.create({ network: net, marketAddress, provider: user, amount: '1' });
      await Swap.create({ network: net, marketAddress, taker: user, amount: '2' });
      await Swap.create({ network: net, marketAddress, provider: user, amount: '1' });
      await expect(service.extendUser(u, net)).resolves.toBeUndefined();
      expect(u.volume).toEqual('4');
    });

    it(`should calculate correct 'volumeUsd'`, async () => {
      await Swap.create({ network: net, marketAddress, provider: user, valueUsd: '1' });
      await Swap.create({ network: net, marketAddress, taker: user, valueUsd: '2' });
      await Swap.create({ network: net, marketAddress, provider: user, valueUsd: '1' });
      await expect(service.extendUser(u, net)).resolves.toBeUndefined();
      expect(u.volumeUsd).toEqual(4);
    });

    it(`should calculate correct 'lastActiveAt'`, async () => {
      const swap = await Swap.create({
        network: net,
        marketAddress,
        provider: user,
        createdAt: moment().subtract(1, 's').toISOString(),
      });
      let swap2 = await Swap.create({
        network: net,
        marketAddress,
        provider: user2,
        taker: user,
        instant: true,
        createdAt: moment().toISOString(),
      });
      await expect(service.extendUser(u, net)).resolves.toBeUndefined();
      expect(u.lastActiveAt).toEqual(swap2.createdAt);

      // when user is payer and last swap was not paid
      await Market.updateById(market.id, { baseType: AssetType.ERC20, quoteType: AssetType.SYNTH });
      await Swap.updateById(swap2.id, { instant: false });
      await expect(service.extendUser(u, net)).resolves.toBeUndefined();
      expect(u.lastActiveAt).toEqual(swap2.createdAt);

      // when user is payer and last swap was paid
      await Market.updateById(market.id, { baseType: AssetType.ERC20, quoteType: AssetType.SYNTH });
      swap2 = await Swap.updateById(swap2.id, {
        instant: false,
        paid: true,
        paidAt: moment().add('10', 's').toISOString(),
      });
      await expect(service.extendUser(u, net)).resolves.toBeUndefined();
      expect(u.lastActiveAt).toEqual(swap2.paidAt);

      // when user is releaser and last swap was not released
      await Market.updateById(market.id, { baseType: AssetType.ERC20, quoteType: AssetType.SYNTH });
      await Swap.updateById(swap2.id, { released: false });
      await expect(service.extendUser(u2, net)).resolves.toBeUndefined();
      expect(u2.lastActiveAt).toEqual(swap2.createdAt);

      // when user is releaser, last swap was released and user was the finalizer
      await Market.updateById(market.id, { baseType: AssetType.ERC20, quoteType: AssetType.SYNTH });
      swap2 = await Swap.updateById(swap2.id, {
        released: true,
        finalizer: u2.address,
        finalizedAt: moment().add('10', 's').toISOString(),
      });
      await expect(service.extendUser(u2, net)).resolves.toBeUndefined();
      expect(u2.lastActiveAt).toEqual(swap2.finalizedAt);

      // when user is releaser, last swap was released and user was not the finalizer
      await Market.updateById(market.id, { baseType: AssetType.ERC20, quoteType: AssetType.SYNTH });
      swap2 = await Swap.updateById(swap2.id, {
        released: true,
        finalizer: '0xFinalizer',
        finalizedAt: moment().add('10', 's').toISOString(),
      });
      await expect(service.extendUser(u2, net)).resolves.toBeUndefined();
      expect(u2.lastActiveAt).toEqual(swap2.createdAt);
    });
  });
});
