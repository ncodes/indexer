import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { NoopLogger } from '../../../common/loggers/noop_logger';
import { DBService } from '../../../db/DBService';
import OnAppealPeriodEnd from './on_appeal_period_end';
import { NotifierService, NotificationID } from '../../mailer/NotifierService';
import Dispute from '../../../models/dispute';
import * as moment from 'moment';
import Swap from '../../../models/swap';
import Draft from '../../../models/draft';
import Reveal from '../../../models/reveal';
import Market from '../../../models/market';

const mockNotify = jest.fn();
const MockNotifierService = jest.fn().mockImplementation(() => {
  return { notify: mockNotify };
});

describe('OnAppealPeriodEnd', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let srv: OnAppealPeriodEnd;
  const net = 'net';
  const marketAddress = '0xMarket';
  const provider = '0xProvider';
  const taker = '0xTaker';
  const draftee = '0xDraftee';

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [ConfigService, OnAppealPeriodEnd, NotifierService],
    })
      .overrideProvider(NotifierService)
      .useValue(new MockNotifierService())
      .compile();

    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    srv = app.get<OnAppealPeriodEnd>(OnAppealPeriodEnd);
    await app.init();
  });

  describe('.process', () => {
    let swap: Swap;
    let market: Market;
    let dispute: Dispute;
    const orderId = 1;
    const disputeId = 1;

    beforeEach(async () => {
      market = await Market.create({
        network: net,
        address: marketAddress,
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
          appealEndAt: now.add(1, 'h').toISOString(),
        });
        dispute = await Dispute.create({
          network: net,
          marketAddress,
          disputeId,
          orderId,
          numMediators: 3,
          appealEndAt: now.subtract(1, 'h').toISOString(),
        });
        await Draft.create({
          network: net,
          marketAddress,
          orderId,
          disputeIndex: disputeId,
          owner: draftee,
        });
      });

      it('should set dispute.notifiedOnAppealEndAt = true', async () => {
        await expect(srv.process()).resolves.toBeUndefined();
        dispute = await Dispute.getById(dispute.id);
        expect(dispute.notifiedOnAppealEndAt).toBeTruthy();
      });

      it('should not send notification to taker, provider and draftees', async () => {
        await expect(srv.process()).resolves.toBeUndefined();
        expect(mockNotify).not.toHaveBeenCalled();
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
          appealEndAt: now.add(1, 'h').toISOString(),
        });
        await Dispute.create({
          network: net,
          marketAddress,
          disputeId,
          orderId,
          numMediators: 3,
          appealEndAt: now.subtract(1, 'h').toISOString(),
        });
        await Draft.create({
          network: net,
          marketAddress,
          orderId,
          disputeIndex: disputeId,
          owner: draftee,
        });
        await Reveal.create({ network: net, orderId, disputeId, vote: '0x30' });
        await Reveal.create({ network: net, orderId, disputeId, vote: '0x30' });
      });

      it('should send notification to taker, provider and draftees', async () => {
        await expect(srv.process()).resolves.toBeUndefined();
        swap.market = market;
        const payload = { swap, disputeId, drafted: undefined };
        expect(mockNotify).toHaveBeenCalledTimes(3);
        expect(mockNotify).toHaveBeenNthCalledWith(1, NotificationID.AppealPhaseEnded, net, provider, payload);
        expect(mockNotify).toHaveBeenNthCalledWith(2, NotificationID.AppealPhaseEnded, net, taker, payload);
        payload.drafted = true;
        expect(mockNotify).toHaveBeenNthCalledWith(3, NotificationID.AppealPhaseEnded, net, draftee, payload);
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
          appealEndAt: now.add(1, 'h').toISOString(),
        });
        await Dispute.create({
          network: net,
          marketAddress,
          disputeId,
          orderId,
          numMediators: 3,
          appealEndAt: now.subtract(1, 'h').toISOString(),
        });
        await Draft.create({
          network: net,
          marketAddress,
          orderId,
          disputeIndex: disputeId,
          owner: draftee,
        });
        await Reveal.create({ network: net, orderId, disputeId, vote: '0x31' });
        await Reveal.create({ network: net, orderId, disputeId, vote: '0x31' });
      });

      it('should send notification to taker, provider and draftees', async () => {
        await expect(srv.process()).resolves.toBeUndefined();
        swap.market = market;
        const payload = { swap, disputeId, drafted: undefined };
        expect(mockNotify).toHaveBeenCalledTimes(3);
        expect(mockNotify).toHaveBeenNthCalledWith(1, NotificationID.AppealPhaseEnded, net, provider, payload);
        expect(mockNotify).toHaveBeenNthCalledWith(2, NotificationID.AppealPhaseEnded, net, taker, payload);
        payload.drafted = true;
        expect(mockNotify).toHaveBeenNthCalledWith(3, NotificationID.AppealPhaseEnded, net, draftee, payload);
      });
    });
  });
});
