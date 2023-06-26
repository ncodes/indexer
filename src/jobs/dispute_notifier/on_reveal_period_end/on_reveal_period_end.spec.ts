import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NoopLogger } from '../../../common/loggers/noop_logger';
import { DBService } from '../../../db/DBService';
import { NotifierService, NotificationID } from '../../mailer/NotifierService';
import Dispute from '../../../models/dispute';
import * as moment from 'moment';
import Swap from '../../../models/swap';
import Draft from '../../../models/draft';
import Reveal from '../../../models/reveal';
import OnRevealPeriodEnd from './on_reveal_period_end';
import { commify, formatUnits } from 'ethers/lib/utils';
import { ConfigService } from '../../../config/config.service';
import Meta, { MetaKeys } from '../../../models/meta';
import Market from '../../../models/market';

const mockNotify = jest.fn();
const MockNotifierService = jest.fn().mockImplementation(() => {
  return { notify: mockNotify };
});

describe('OnRevealPeriodEnd', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let srv: OnRevealPeriodEnd;
  const net = 'net';
  const provider = '0xProvider';
  const taker = '0xTaker';
  const draftee = '0xDraftee';
  const marketAddress = '0xMarket';

  const disputeCost = '100';
  const cfg = {};

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
    await app.close();
  });

  beforeEach(async () => {
    MockNotifierService.mockClear();
    mockNotify.mockReset();
    await db.truncateTables();

    await Meta.create(
      Meta.makeNetKey(net, MetaKeys.ContractsParams),
      JSON.stringify({
        disputeCost: '100',
      }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [ConfigService, OnRevealPeriodEnd, NotifierService],
    })
      .overrideProvider(NotifierService)
      .useValue(new MockNotifierService())
      .compile();

    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    srv = app.get<OnRevealPeriodEnd>(OnRevealPeriodEnd);
    await app.init();

    jest.spyOn(app.get(ConfigService), 'get').mockImplementation((param) => {
      return cfg[param];
    });
  });

  describe('.process', () => {
    let market: Market;
    let dispute: Dispute;
    let swap: Swap;
    const disputeId = 1;
    const orderId = 1;

    beforeEach(async () => {
      market = await Market.create({
        network: net,
        address: '0xMarket',
      });
      swap = await Swap.create({
        network: net,
        marketAddress,
        orderId,
        base: 'BASE',
        quote: 'QUOTE',
        provider: provider,
        taker: taker,
      });
      await Draft.create({
        network: net,
        marketAddress,
        orderId,
        disputeIndex: disputeId,
        owner: draftee,
      });
    });

    it('should return undefined if srv is already processing', async () => {
      srv.setProcessing(true);
      await expect(srv.process()).resolves.toBeUndefined();
    });

    describe(`
    (1) with matching dispute 
    (2) when outcome is stalled because of reveals=0 (number of reveals >= majority)`, () => {
      beforeEach(async () => {
        const now = moment();
        await Dispute.create({
          network: net,
          marketAddress,
          disputeId,
          orderId,
          numMediators: 3,
        });
        dispute = await Dispute.create({
          network: net,
          marketAddress,
          disputeId,
          orderId,
          numMediators: 3,
          revealEndAt: now.subtract(1, 'h').toISOString(),
          appealEndAt: now.add(1, 'h').toISOString(),
        });
      });

      it('should set dispute.notifiedOnRevealEndAt = true', async () => {
        await expect(srv.process()).resolves.toBeUndefined();
        dispute = await Dispute.getById(dispute.id);
        expect(dispute.notifiedOnRevealEndAt).toBeTruthy();
      });

      it('should send notification to taker, provider and draftees', async () => {
        swap.market = market;
        await expect(srv.process()).resolves.toBeUndefined();
        const payload = {
          swap,
          disputeId,
          numMediators: dispute.numMediators,
          nRelease: 0,
          nCancel: 0,
          majority: 2,
          participant: true,
          cost: commify(formatUnits(disputeCost, 18)),
          appealPhaseHoursLeft: moment(dispute.appealEndAt).fromNow(false),
        };
        expect(mockNotify).toHaveBeenNthCalledWith(1, NotificationID.RevealPhaseEnded, net, provider, payload);
        expect(mockNotify).toHaveBeenNthCalledWith(2, NotificationID.RevealPhaseEnded, net, taker, payload);
        delete payload.participant;
        expect(mockNotify).toHaveBeenNthCalledWith(3, NotificationID.RevealPhaseEnded, net, draftee, payload);
      });
    });

    describe(`
    (1) with matching dispute 
    (2) when outcome is cancelled`, () => {
      beforeEach(async () => {
        const now = moment();
        await Dispute.create({
          network: net,
          marketAddress,
          disputeId,
          orderId,
          numMediators: 3,
        });
        dispute = await Dispute.create({
          network: net,
          marketAddress,
          disputeId,
          orderId,
          numMediators: 3,
          revealEndAt: now.subtract(1, 'h').toISOString(),
          appealEndAt: now.add(1, 'h').toISOString(),
        });
        await Reveal.create({ network: net, orderId, disputeId, vote: '0x30' });
        await Reveal.create({ network: net, orderId, disputeId, vote: '0x30' });
      });

      it('should send notification to taker, provider and draftees', async () => {
        swap.market = market;
        await expect(srv.process()).resolves.toBeUndefined();
        const payload = {
          swap,
          disputeId,
          numMediators: dispute.numMediators,
          nRelease: 0,
          nCancel: 2,
          majority: 2,
          participant: true,
          cost: commify(formatUnits(disputeCost, 18)),
          appealPhaseHoursLeft: moment(dispute.appealEndAt).fromNow(false),
        };
        expect(mockNotify).toHaveBeenNthCalledWith(1, NotificationID.RevealPhaseEnded, net, provider, payload);
      });
    });

    describe(`
    (1) with matching dispute 
    (2) when outcome is released`, () => {
      beforeEach(async () => {
        const now = moment();
        await Dispute.create({
          network: net,
          marketAddress,
          disputeId,
          orderId,
          numMediators: 3,
        });
        dispute = await Dispute.create({
          network: net,
          marketAddress,
          disputeId,
          orderId,
          numMediators: 3,
          revealEndAt: now.subtract(1, 'h').toISOString(),
          appealEndAt: now.add(1, 'h').toISOString(),
        });
        await Reveal.create({ network: net, orderId, disputeId, vote: '0x31' });
        await Reveal.create({ network: net, orderId, disputeId, vote: '0x31' });
      });

      it('should send notification to taker, provider and draftees', async () => {
        swap.market = market;
        await expect(srv.process()).resolves.toBeUndefined();
        const payload = {
          swap,
          disputeId,
          numMediators: dispute.numMediators,
          nRelease: 2,
          nCancel: 0,
          majority: 2,
          participant: true,
          cost: commify(formatUnits(disputeCost, 18)),
          appealPhaseHoursLeft: moment(dispute.appealEndAt).fromNow(false),
        };
        expect(mockNotify).toHaveBeenNthCalledWith(1, NotificationID.RevealPhaseEnded, net, provider, payload);
      });
    });
  });
});
