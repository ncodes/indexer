import { Test, TestingModule } from '@nestjs/testing';
import { DBService } from '../../db/DBService';
import SwapsService from './swaps.service';
import Swap from '../../models/swap';
import User from '../../models/user';
import Dispute from '../../models/dispute';
import Draft from '../../models/draft';

describe('SwapsService', () => {
  let module: TestingModule;
  let service: SwapsService;
  const db = DBService.getForTest();
  const net = 'ethereum';

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
      providers: [SwapsService],
    }).compile();

    service = module.get<SwapsService>(SwapsService);
  });

  describe('.getParticipants', () => {
    describe('when swap has no dispute', () => {
      it('should return correct participants', async () => {
        const user1 = await User.create({ address: '0xTaker', id: 'user1' });
        const user2 = await User.create({ address: '0xProvider', id: 'user1' });
        const swap = await Swap.create({
          taker: '0xTaker',
          provider: '0xProvider',
          network: net,
          marketAddress: '0xMarket',
          orderId: 1,
        });
        const res = await service.getParticipants(swap, false);
        expect(res).toHaveLength(2);
        expect(res[0]).toEqual(user2.id);
        expect(res[1]).toEqual(user1.id);
      });

      describe('when a participant does not have a user account', () => {
        it('should return correct participants', async () => {
          const user1 = await User.create({ address: '0xTaker', id: 'user1' });
          const swap = await Swap.create({
            taker: '0xTaker',
            provider: '0xProvider', // participant 1
            network: net,
            marketAddress: '0xMarket', // participant 2
            orderId: 1,
          });
          const res = await service.getParticipants(swap, false);
          expect(res).toHaveLength(1);
          expect(res[0]).toEqual(user1.id);
        });
      });
    });

    describe('when swap has as dispute', () => {
      it('should return correct participants', async () => {
        const user1 = await User.create({ address: '0xTaker', id: 'user1' });
        const user2 = await User.create({ address: '0xProvider', id: 'user2' });
        const user3 = await User.create({ address: '0xDraftee', id: 'user3' });
        const user4 = await User.create({ address: '0xDraftee2', id: 'user4' });
        const swap = await Swap.create({
          taker: '0xTaker',
          provider: '0xProvider',
          network: net,
          marketAddress: '0xMarket',
          orderId: 1,
        });
        const dispute = await Dispute.create({
          network: net,
          orderId: swap.orderId,
          marketAddress: swap.marketAddress,
          disputeId: 0,
        });
        await Draft.create({
          network: net,
          marketAddress: swap.marketAddress,
          orderId: swap.orderId,
          disputeIndex: dispute.disputeId,
          owner: '0xDraftee',
        });
        await Draft.create({
          network: net,
          marketAddress: swap.marketAddress,
          orderId: swap.orderId,
          disputeIndex: dispute.disputeId,
          owner: '0xDraftee2',
        });
        const res = await service.getParticipants(swap, false);
        expect(res).toHaveLength(4);
        expect(res[0]).toEqual(user2.id);
        expect(res[1]).toEqual(user1.id);
        expect(res[2]).toEqual(user3.id);
        expect(res[3]).toEqual(user4.id);
      });
    });

    describe('when swap has an appealed dispute and addAppealedDisputeDraftees=true', () => {
      it('should return correct participants', async () => {
        const user1 = await User.create({ address: '0xTaker', id: 'user1' });
        const user2 = await User.create({ address: '0xProvider', id: 'user2' });
        const user3 = await User.create({ address: '0xDraftee', id: 'user3' });
        const user4 = await User.create({ address: '0xDraftee2', id: 'user4' });
        const user5 = await User.create({ address: '0xDraftee3', id: 'user4' });
        const swap = await Swap.create({
          taker: '0xTaker',
          provider: '0xProvider',
          network: net,
          marketAddress: '0xMarket',
          orderId: 1,
        });
        const dispute = await Dispute.create({
          network: net,
          orderId: swap.orderId,
          marketAddress: swap.marketAddress,
          disputeId: 0,
        });
        const dispute1 = await Dispute.create({
          network: net,
          orderId: swap.orderId,
          marketAddress: swap.marketAddress,
          disputeId: 1,
        });
        await Draft.create({
          network: net,
          marketAddress: swap.marketAddress,
          orderId: swap.orderId,
          disputeIndex: dispute.disputeId,
          owner: '0xDraftee',
        });
        await Draft.create({
          network: net,
          marketAddress: swap.marketAddress,
          orderId: swap.orderId,
          disputeIndex: dispute.disputeId,
          owner: '0xDraftee2',
        });
        await Draft.create({
          network: net,
          marketAddress: swap.marketAddress,
          orderId: swap.orderId,
          disputeIndex: dispute1.disputeId,
          owner: '0xDraftee3',
        });
        const res = await service.getParticipants(swap, true);
        expect(res).toHaveLength(5);
        expect(res[0]).toEqual(user2.id);
        expect(res[1]).toEqual(user1.id);
        expect(res[2]).toEqual(user5.id);
        expect(res[3]).toEqual(user3.id);
        expect(res[4]).toEqual(user4.id);
      });
    });
  });
});
