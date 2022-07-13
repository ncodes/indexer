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
import OnEvidencePeriodEnd from './on_evidence_period_end';

const mockNotify = jest.fn();
const MockNotifierService = jest.fn().mockImplementation(() => {
  return { notify: mockNotify };
});

describe('OnEvidencePeriodEnd', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let srv: OnEvidencePeriodEnd;
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
      providers: [ConfigService, OnEvidencePeriodEnd, NotifierService],
    })
      .overrideProvider(NotifierService)
      .useValue(new MockNotifierService())
      .compile();

    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    srv = app.get<OnEvidencePeriodEnd>(OnEvidencePeriodEnd);
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
          evidenceEndAt: now.add(1, 'h').toISOString(),
        });
        dispute = await Dispute.create({
          network: net,
          marketId,
          disputeId,
          orderId,
          numMediators: 3,
          evidenceEndAt: now.subtract(1, 'h').toISOString(),
          commitEndAt: now.add(1, 'h').toISOString(),
        });
        await Draft.create({
          network: net,
          marketId,
          orderId,
          disputeIndex: disputeId,
          owner: '0xDraftee',
        });
      });

      it('should set dispute.notifiedOnEvidenceEndAt = true', async () => {
        await expect(srv.process()).resolves.toBeUndefined();
        dispute = await Dispute.getById(dispute.id);
        expect(dispute.notifiedOnEvidenceEndAt).toBeTruthy();
      });

      it('should send notification to taker, provider and draftees', async () => {
        await expect(srv.process()).resolves.toBeUndefined();
        const payload = {
          marketId,
          orderId,
          network: net,
          disputeId,
          drafted: undefined,
          pair: swap.getPair(),
          commitPhaseHoursLeft: moment(dispute.commitEndAt).fromNow(true),
        };
        expect(mockNotify).toHaveBeenNthCalledWith(
          1,
          NotifyType.EvidencePhaseEnded,
          net,
          '0xProvider',
          payload,
        );
        expect(mockNotify).toHaveBeenNthCalledWith(
          2,
          NotifyType.EvidencePhaseEnded,
          net,
          '0xTaker',
          payload,
        );
        payload.drafted = true;
        expect(mockNotify).toHaveBeenNthCalledWith(
          3,
          NotifyType.EvidencePhaseEnded,
          net,
          '0xDraftee',
          payload,
        );
      });
    });
  });
});
