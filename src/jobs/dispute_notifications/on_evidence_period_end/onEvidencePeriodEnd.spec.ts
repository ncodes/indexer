import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as moment from 'moment';
import { NoopLogger } from '../../../common/loggers/noop_logger';
import { DBService } from '../../../db/db.service';
import Dispute from '../../../models/dispute';
import Draft from '../../../models/draft';
import Market from '../../../models/market';
import Swap from '../../../models/swap';
import { NotificationService } from '../../notifications/NotificationService';
import { NotificationID } from '../../notifications/common';
import OnEvidencePeriodEnd from './onEvidencePeriodEnd';

const mockNotify = jest.fn();
const MockNotifierService = jest.fn().mockImplementation(() => {
  return { notify: mockNotify };
});

describe('OnEvidencePeriodEnd', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let srv: OnEvidencePeriodEnd;
  const net = 'ethereum';
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
      providers: [ConfigService, OnEvidencePeriodEnd, NotificationService],
    })
      .overrideProvider(NotificationService)
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
      let market: Market;
      const marketAddress = '0xMarket';
      const disputeId = 1;
      const orderId = 1;

      beforeEach(async () => {
        market = await Market.create({
          network: net,
          address: marketAddress,
        });
        const now = moment();
        swap = await Swap.create({
          network: net,
          marketAddress,
          orderId,
          base: 'BASE',
          quote: 'QUOTE',
          provider: provider,
          taker: taker,
        });
        await Dispute.create({
          network: net,
          marketAddress,
          disputeId,
          orderId,
          numMediators: 3,
          evidenceEndAt: now.add(1, 'h').toISOString(),
        });
        dispute = await Dispute.create({
          network: net,
          marketAddress,
          disputeId,
          orderId,
          numMediators: 3,
          evidenceEndAt: now.subtract(1, 'h').toISOString(),
          commitEndAt: now.add(1, 'h').toISOString(),
        });
        await Draft.create({
          network: net,
          marketAddress,
          orderId,
          disputeIndex: disputeId,
          owner: draftee,
        });
      });

      it('should set dispute.notifiedOnEvidenceEndAt = true', async () => {
        await expect(srv.process()).resolves.toBeUndefined();
        dispute = await Dispute.getById(dispute.id);
        expect(dispute.notifiedOnEvidenceEndAt).toBeTruthy();
      });

      it('should send notification to taker, provider and draftees', async () => {
        await expect(srv.process()).resolves.toBeUndefined();
        swap.market = market;
        const payload = {
          swap,
          disputeId,
          drafted: undefined,
          commitPhaseHoursLeft: moment(dispute.commitEndAt).fromNow(true),
        };
        expect(mockNotify).toHaveBeenNthCalledWith(1, NotificationID.EvidencePhaseEnded, net, provider, payload);
        expect(mockNotify).toHaveBeenNthCalledWith(2, NotificationID.EvidencePhaseEnded, net, taker, payload);
        payload.drafted = true;
        expect(mockNotify).toHaveBeenNthCalledWith(3, NotificationID.EvidencePhaseEnded, net, draftee, payload);
      });
    });
  });
});
