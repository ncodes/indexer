import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as moment from 'moment';
import CacheService from '../../cacher/cache.service';
import { DBService } from '../../db/db.service';
import BadgeGrant from '../../models/badge_grant';
import Market, { AssetType } from '../../models/market';
import { defaultNotificationSettings } from '../../models/notification_setting';
import PaymentMethod from '../../models/payment_method';
import Swap from '../../models/swap';
import User from '../../models/user';
import { JointLinkService } from '../../services/joint_link.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { RedisService } from '../../services/redis/redis.service';
import AirdropService from '../airdrop/airdrop.service';
import { RefereeBonus } from '../airdrop/constants';
import TapService from '../airdrop/tap.service';
import ConvosService from '../convos/convos.service';
import { MarketService } from '../markets/market.service';
import { UserService } from './user.service';

const mockTryToUsd = jest.fn();
const MetadataServiceMock = jest.fn().mockImplementation(() => {
  return {
    tryToUsd: mockTryToUsd,
  };
});

const mockCreateLink = jest
  .fn()
  .mockResolvedValue({ url: 'url', normalizedUrl: 'normalizedUrl', shortUrl: 'shortUrl' });
const MockJointLinkService = jest.fn().mockImplementation(() => {
  return {
    createReferralLink: mockCreateLink,
  };
});

const MockRedis = jest.fn().mockImplementation(() => {
  return {
    get: jest.fn(),
    set: jest.fn(),
    incrBy: jest.fn(),
    sAdd: jest.fn(),
    setEx: jest.fn(),
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
      providers: [
        UserService,
        MarketService,
        AirdropService,
        MetadataService,
        RedisService,
        ConvosService,
        JointLinkService,
        CacheService,
        TapService,
      ],
    })
      .overrideProvider(MetadataService)
      .useValue(new MetadataServiceMock())
      .overrideProvider(RedisService)
      .useValue(new MockRedis())
      .overrideProvider(JointLinkService)
      .useValue(new MockJointLinkService())
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

    it(`should load default payment method`, async () => {
      const pm = await PaymentMethod.create({ userId: u.id, network: net });
      u = await User.updateById(u.id, { defaultPaymentMethodId: pm.id });
      await expect(service.extendUser(u, net)).resolves.toBeUndefined();
      expect(u.paymentMethod).toBeDefined();
      expect(u.paymentMethod.id).toEqual(pm.id);
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
      await Swap.create({
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

    it(`should set default notification settings when not loaded`, async () => {
      await expect(service.extendUser(u, net)).resolves.toBeUndefined();
      expect(u.notificationSettings).toEqual(defaultNotificationSettings);
    });
  });

  describe('.registerDevice', () => {
    it(`should return device token`, async () => {
      const mockRegisterInstallation = jest
        .spyOn(module.get(ConvosService), 'registerInstallation')
        .mockResolvedValue(undefined);

      let u = await User.create({ address: user });
      const res = await service.registerDevice(u);
      u = await User.getById(u.id);
      expect(u.deviceTokenEmail).toHaveLength(32);
      expect(res).toEqual(u.deviceTokenEmail);

      expect(mockRegisterInstallation).toBeCalledWith(u.id, 'email', u.deviceTokenEmail);
    });

    it(`should not reset device token if already set`, async () => {
      let u = await User.create({ address: user, deviceTokenEmail: 'token-01' });
      service.registerDevice(u);
      u = await User.getById(u.id);
      expect(u.deviceTokenEmail).toEqual('token-01');
    });
  });

  describe('.unregisterDevice', () => {
    it(`should return true and clear device token`, async () => {
      const mockUnregisterInstallation = jest
        .spyOn(module.get(ConvosService), 'unregisterInstallation')
        .mockResolvedValue(undefined);

      let u = await User.create({ address: user, deviceTokenEmail: 'token-01' });
      const res = await service.unregisterDevice(u, 'email');
      expect(res).toBeTruthy();
      u = await User.getById(u.id);
      expect(u.deviceTokenEmail).toBeNull();

      expect(mockUnregisterInstallation).toBeCalledWith(u.id);
    });
  });

  describe('.enableReferrerOps', () => {
    it(`should return false when user already has a ref code`, async () => {
      const referrer = '0xReferrer';
      const u = await User.create({ address: user, refCode: '12345' });
      const res = await service.enableReferrerOps(true, referrer, u);
      expect(res).toBeFalsy();
      expect(mockCreateLink).not.toBeCalled();
    });

    it(`should return true and set referrer when user is new`, async () => {
      let u = await User.create({ address: user });
      const referrer = await User.create({ address: '0xReferrer', refCode: '0xReferrerCode' });

      const mockCreateTap = jest.spyOn(module.get(TapService), 'createTap').mockResolvedValue(undefined);

      const res = await service.enableReferrerOps(true, '0xReferrerCode', u);
      expect(res).toBeTruthy();
      u = await User.getById(u.id);
      expect(u.referrer).toEqual(referrer.address);
      expect(u.refCode).toHaveLength(5);
      expect(mockCreateLink).toBeCalledWith(u.refCode);

      // Create referee bonus tap for the user
      expect(mockCreateTap).toBeCalledWith({
        userId: u.id,
        bonus: true,
        bonusName: 'referee_bonus',
        bonusValue: RefereeBonus.toString(),
      });
    });

    it(`should return true and not set referrer when user is not new`, async () => {
      const referrer = '0xReferrer';
      let u = await User.create({ address: user });
      const res = await service.enableReferrerOps(false, referrer, u);
      expect(res).toBeTruthy();
      u = await User.getById(u.id);
      expect(u.referrer).toBeNull();
      expect(u.refCode).toHaveLength(5);
      expect(mockCreateLink).toBeCalledWith(u.refCode);
    });
  });
});
