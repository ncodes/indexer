import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { NoopLogger } from '../../../common/loggers/noop_logger';
import { DBService } from '../../../db/DBService';
import { NotifierService, NotificationID } from '../../mailer/NotifierService';
import Dispute from '../../../models/dispute';
import * as moment from 'moment';
import Swap from '../../../models/swap';
import Draft from '../../../models/draft';
import OnCommitPeriodEnd from './on_commit_period_end';

const mockNotify = jest.fn();
const MockNotifierService = jest.fn().mockImplementation(() => {
  return { notify: mockNotify };
});

describe('OnCommitPeriodEnd', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let srv: OnCommitPeriodEnd;
  const net = 'net';

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
      providers: [ConfigService, OnCommitPeriodEnd, NotifierService],
    })
      .overrideProvider(NotifierService)
      .useValue(new MockNotifierService())
      .compile();

    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    srv = app.get<OnCommitPeriodEnd>(OnCommitPeriodEnd);
    await app.init();
  });

  describe('.process', () => {
    it('should return undefined if srv is already processing', async () => {
      srv.setProcessing(true);
      await expect(srv.process()).resolves.toBeUndefined();
    });

    describe(`with matching dispute`, () => {
      let dispute: Dispute;
      let swap: Swap;
      const marketAddress = '0xMarket';
      const disputeId = 1;
      const orderId = 1;

      beforeEach(async () => {
        const now = moment();
        swap = await Swap.create({
          network: net,
          marketAddress,
          orderId,
          base: 'BASE',
          quote: 'QUOTE',
          provider: '0xProvider',
          taker: '0xTaker',
        });
        await Dispute.create({
          network: net,
          marketAddress,
          disputeId,
          orderId,
          numMediators: 3,
          commitEndAt: now.add(1, 'h').toISOString(),
        });
        dispute = await Dispute.create({
          network: net,
          marketAddress,
          disputeId,
          orderId,
          numMediators: 3,
          commitEndAt: now.subtract(1, 'h').toISOString(),
          revealEndAt: now.add(1, 'h').toISOString(),
        });
        await Draft.create({
          network: net,
          marketAddress,
          orderId,
          disputeIndex: disputeId,
          owner: '0xDraftee',
        });
      });

      it('should set dispute.notifiedOnCommitEndAt = true', async () => {
        await expect(srv.process()).resolves.toBeUndefined();
        dispute = await Dispute.getById(dispute.id);
        expect(dispute.notifiedOnCommitEndAt).toBeTruthy();
      });

      it('should send notification to taker, provider and draftees', async () => {
        await expect(srv.process()).resolves.toBeUndefined();
        const payload = {
          marketAddress,
          orderId,
          network: net,
          disputeId,
          drafted: undefined,
          pair: swap.getPair(),
          revealPhaseHoursLeft: moment(dispute.revealEndAt).fromNow(true),
        };
        expect(mockNotify).toHaveBeenNthCalledWith(1, NotificationID.CommitPhaseEnded, net, '0xProvider', payload);
        expect(mockNotify).toHaveBeenNthCalledWith(2, NotificationID.CommitPhaseEnded, net, '0xTaker', payload);
        payload.drafted = true;
        expect(mockNotify).toHaveBeenNthCalledWith(3, NotificationID.CommitPhaseEnded, net, '0xDraftee', payload);
      });
    });
  });
});
