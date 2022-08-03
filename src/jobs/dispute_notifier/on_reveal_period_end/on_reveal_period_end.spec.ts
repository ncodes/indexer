import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { NoopLogger } from '../../../common/loggers/noop_logger';
import { DBService } from '../../../db/DBService';
import { NotifierService, NotifyType } from '../../mailer/NotifierService';
import Dispute from '../../../models/dispute';
import * as moment from 'moment';
import Swap from '../../../models/swap';
import Draft from '../../../models/draft';
import Reveal from '../../../models/reveal';
import OnRevealPeriodEnd from './on_reveal_period_end';
import { commify, formatUnits } from 'ethers/lib/utils';

const mockNotify = jest.fn();
const MockNotifierService = jest.fn().mockImplementation(() => {
  return { notify: mockNotify };
});

describe('OnRevealPeriodEnd', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let srv: OnRevealPeriodEnd;
  const net = 'net';

  const disputeCost = '100';
  const cfg = {};
  cfg[`app.contractsParams.${net}.disputeCost`] = disputeCost;

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
    it('should return undefined if srv is already processing', async () => {
      srv.setProcessing(true);
      await expect(srv.process()).resolves.toBeUndefined();
    });

    describe(`
    (1) with matching dispute 
    (2) when outcome is stalled because of reveals=0 (number of reveals >= majority)`, () => {
      let dispute: Dispute;
      let swap: Swap;
      const marketId = '0xMarket';
      const disputeId = 1;
      const orderId = 1;

      beforeEach(async () => {
        const now = moment();
        swap = await Swap.create({
          network: net,
          marketId,
          orderId,
          base: 'BASE',
          quote: 'QUOTE',
          provider: '0xProvider',
          taker: '0xTaker',
        });
        await Dispute.create({
          network: net,
          marketId,
          disputeId,
          orderId,
          numMediators: 3,
        });
        dispute = await Dispute.create({
          network: net,
          marketId,
          disputeId,
          orderId,
          numMediators: 3,
          revealEndAt: now.subtract(1, 'h').toISOString(),
          appealEndAt: now.add(1, 'h').toISOString(),
        });
        await Draft.create({
          network: net,
          marketId,
          orderId,
          disputeIndex: disputeId,
          owner: '0xDraftee',
        });
      });

      it('should set dispute.notifiedOnRevealEndAt = true', async () => {
        await expect(srv.process()).resolves.toBeUndefined();
        dispute = await Dispute.getById(dispute.id);
        expect(dispute.notifiedOnRevealEndAt).toBeTruthy();
      });

      it('should send notification to taker, provider and draftees', async () => {
        await expect(srv.process()).resolves.toBeUndefined();
        const payload = {
          marketId,
          orderId,
          network: net,
          disputeId,
          participant: true,
          pair: swap.getPair(),
          outcome: 'Stalled',
          cost: commify(formatUnits(disputeCost, 18)),
          appealPhaseHoursLeft: moment(dispute.appealEndAt).fromNow(false),
        };
        expect(mockNotify).toHaveBeenNthCalledWith(
          1,
          NotifyType.RevealPhaseEnded,
          net,
          '0xProvider',
          payload,
        );
        expect(mockNotify).toHaveBeenNthCalledWith(
          2,
          NotifyType.RevealPhaseEnded,
          net,
          '0xTaker',
          payload,
        );
        delete payload.participant;
        expect(mockNotify).toHaveBeenNthCalledWith(
          3,
          NotifyType.RevealPhaseEnded,
          net,
          '0xDraftee',
          payload,
        );
      });
    });

    describe(`
    (1) with matching dispute 
    (2) when outcome is cancelled`, () => {
      let swap: Swap;
      let dispute: Dispute;
      const marketId = '0xMarket';
      const disputeId = 1;
      const orderId = 1;

      beforeEach(async () => {
        const now = moment();
        swap = await Swap.create({
          network: net,
          marketId,
          orderId,
          base: 'BASE',
          quote: 'QUOTE',
          provider: '0xProvider',
          taker: '0xTaker',
        });
        await Dispute.create({
          network: net,
          marketId,
          disputeId,
          orderId,
          numMediators: 3,
        });
        dispute = await Dispute.create({
          network: net,
          marketId,
          disputeId,
          orderId,
          numMediators: 3,
          revealEndAt: now.subtract(1, 'h').toISOString(),
          appealEndAt: now.add(1, 'h').toISOString(),
        });
        await Draft.create({
          network: net,
          marketId,
          orderId,
          disputeIndex: disputeId,
          owner: '0xDraftee',
        });
        await Reveal.create({ network: net, orderId, disputeId, vote: '0x30' });
        await Reveal.create({ network: net, orderId, disputeId, vote: '0x30' });
      });

      it('should send notification to taker, provider and draftees', async () => {
        await expect(srv.process()).resolves.toBeUndefined();
        const payload = {
          marketId,
          orderId,
          network: net,
          disputeId,
          participant: true,
          pair: swap.getPair(),
          outcome: 'Cancel',
          cost: commify(formatUnits(disputeCost, 18)),
          appealPhaseHoursLeft: moment(dispute.appealEndAt).fromNow(false),
        };
        expect(mockNotify).toHaveBeenNthCalledWith(
          1,
          NotifyType.RevealPhaseEnded,
          net,
          '0xProvider',
          payload,
        );
      });
    });

    describe(`
    (1) with matching dispute 
    (2) when outcome is released`, () => {
      let swap: Swap;
      let dispute: Dispute;
      const marketId = '0xMarket';
      const disputeId = 1;
      const orderId = 1;

      beforeEach(async () => {
        const now = moment();
        swap = await Swap.create({
          network: net,
          marketId,
          orderId,
          base: 'BASE',
          quote: 'QUOTE',
          provider: '0xProvider',
          taker: '0xTaker',
        });
        await Dispute.create({
          network: net,
          marketId,
          disputeId,
          orderId,
          numMediators: 3,
        });
        dispute = await Dispute.create({
          network: net,
          marketId,
          disputeId,
          orderId,
          numMediators: 3,
          revealEndAt: now.subtract(1, 'h').toISOString(),
          appealEndAt: now.add(1, 'h').toISOString(),
        });
        await Draft.create({
          network: net,
          marketId,
          orderId,
          disputeIndex: disputeId,
          owner: '0xDraftee',
        });
        await Reveal.create({ network: net, orderId, disputeId, vote: '0x31' });
        await Reveal.create({ network: net, orderId, disputeId, vote: '0x31' });
      });

      it('should send notification to taker, provider and draftees', async () => {
        await expect(srv.process()).resolves.toBeUndefined();
        const payload = {
          marketId,
          orderId,
          network: net,
          disputeId,
          participant: true,
          pair: swap.getPair(),
          outcome: 'Release',
          cost: commify(formatUnits(disputeCost, 18)),
          appealPhaseHoursLeft: moment(dispute.appealEndAt).fromNow(false),
        };
        expect(mockNotify).toHaveBeenNthCalledWith(
          1,
          NotifyType.RevealPhaseEnded,
          net,
          '0xProvider',
          payload,
        );
      });
    });
  });
});
