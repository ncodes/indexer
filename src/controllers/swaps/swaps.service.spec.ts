import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DBService } from '../../db/DBService';
import Dispute from '../../models/dispute';
import Draft from '../../models/draft';
import Market, { AssetType } from '../../models/market';
import Swap from '../../models/swap';
import User from '../../models/user';
import { powOf } from '../../network/common';
import { MetadataService } from '../../services/metadata/metadata.service';
import SwapService from './swap.service';

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

const mockMetadataTryToUsd = jest.fn();
const MetadataServiceMock = jest.fn().mockImplementation(() => {
  return { tryToUsd: mockMetadataTryToUsd };
});

describe('SwapsService', () => {
  let module: TestingModule;
  let cfgObj = {};
  let service: SwapService;
  const db = DBService.getForTest();
  const net = 'ethereum';
  const marketAddress = '0xMarket';
  const baseAddress = '0xBase';
  const quoteAddress = '0xQuote';
  const base = 'Base';
  const quote = 'Quote';

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

    cfgObj = {};
    cfgObj[`app.contractsAddress.p2pTokenAddr`] = '0xP2PAddress';

    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    module = await Test.createTestingModule({
      providers: [ConfigService, SwapService, MetadataService],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .overrideProvider(MetadataService)
      .useValue(new MetadataServiceMock())
      .compile();

    service = module.get<SwapService>(SwapService);
  });

  let market: Market;
  let swap: Swap;

  beforeEach(async () => {
    market = new Market({
      network: net,
      address: marketAddress,
      quoteAddress,
      baseAddress,
      base,
      quote,
      baseDecimals: 18,
      quoteDecimals: 18,
    });
    swap = new Swap({
      network: net,
      price: powOf(10, 18).toString(),
      market,
      quoteAddress,
      baseAddress,
      base,
      quote,
    });
  });

  describe('.extendSwap', () => {
    it("should update correctly when 'priceUsd' is set", async () => {
      mockMetadataTryToUsd.mockResolvedValue(100);
      swap.price = '10';
      await service.extendSwap(swap, ['priceUsd']);
      expect(swap.priceUsd).toEqual(100);
      expect(mockMetadataTryToUsd).toBeCalledWith(net, '10', quoteAddress);
    });

    it("should update correctly when 'amountUsd' is set", async () => {
      mockMetadataTryToUsd.mockResolvedValue(100);
      swap.amount = '10';
      await service.extendSwap(swap, ['amountUsd']);
      expect(swap.amountUsd).toEqual(100);
      expect(mockMetadataTryToUsd).toBeCalledWith(net, '10', baseAddress);
    });

    it("should update correctly when 'cost' is set and both assets are fungible", async () => {
      mockMetadataTryToUsd.mockResolvedValue(100);
      market.baseType = AssetType.ERC20;
      market.quoteType = AssetType.ERC20;
      swap.amount = powOf(10, 18).toString();
      swap.price = powOf(10, 18).toString();
      await service.extendSwap(swap, ['cost']);
      expect(swap.cost).toEqual(100);
      expect(swap.costUsd).toEqual(100);
      expect(mockMetadataTryToUsd).toBeCalledWith(net, '100', quoteAddress, {
        isHD: true,
        refetch: true,
      });
    });

    it("should update correctly when 'cost' is set both one asset is not fungible", async () => {
      mockMetadataTryToUsd.mockResolvedValue(100);
      market.baseType = AssetType.ERC20;
      market.quoteType = AssetType.ERC721;
      swap.amount = powOf(10, 18).toString();
      swap.price = powOf(10, 18).toString();
      await service.extendSwap(swap, ['cost']);
      expect(swap.cost).toBeUndefined();
      expect(swap.costUsd).toBeUndefined();
      expect(mockMetadataTryToUsd).not.toBeCalled();
    });

    it("should update correctly when 'fee' is set", async () => {
      jest.spyOn(service, 'getFeeInfo').mockReturnValue({ symbol: 'SYM', address: '0xAddress', fee: '123' });

      mockMetadataTryToUsd.mockResolvedValue(100);
      await service.extendSwap(swap, ['fee']);
      expect(swap.fee).toEqual('123');
      expect(swap.feeSymbol).toEqual('SYM');
      expect(swap.feeUsd).toEqual(100);
      expect(mockMetadataTryToUsd).toBeCalledWith(net, '123', '0xAddress');
    });
  });

  describe('.getFeeInfo', () => {
    it('should return correct result for ERC20/ERC20, ERC20/SYNTH', () => {
      market.baseType = AssetType.ERC20;
      market.quoteType = AssetType.ERC20;
      swap.marketCreatorFee = '10';
      swap.protocolFee = '20';
      let res = service.getFeeInfo(swap);
      expect(res).toEqual({
        symbol: base,
        address: baseAddress,
        fee: '30',
      });

      market.baseType = AssetType.ERC20;
      market.quoteType = AssetType.SYNTH;
      res = service.getFeeInfo(swap);
      expect(res).toEqual({
        symbol: base,
        address: baseAddress,
        fee: '30',
      });
    });

    it('should return correct result for SYNTH/ERC20', () => {
      market.baseType = AssetType.SYNTH;
      market.quoteType = AssetType.ERC20;
      swap.marketCreatorFee = '10';
      swap.protocolFee = '20';
      const res = service.getFeeInfo(swap);
      expect(res).toEqual({
        symbol: quote,
        address: quoteAddress,
        fee: '30',
      });
    });

    it('should return correct result for SYNTH/SYNTH', () => {
      market.baseType = AssetType.SYNTH;
      market.quoteType = AssetType.SYNTH;
      swap.marketCreatorFee = '10';
      swap.protocolFee = '20';
      const res = service.getFeeInfo(swap);
      expect(res).toEqual({
        symbol: 'P2P',
        address: '0xP2PAddress',
        fee: '30',
      });
    });

    it('should return correct result for ERC20/NFT', () => {
      market.baseType = AssetType.ERC20;
      market.quoteType = AssetType.ERC721;
      swap.marketCreatorFee = '10';
      swap.protocolFee = '20';
      const res = service.getFeeInfo(swap);
      expect(res).toEqual({ symbol: '', address: '', fee: '' });
    });

    it('should return correct result for NFT/ERC20', () => {
      market.baseType = AssetType.ERC721;
      market.quoteType = AssetType.ERC20;
      swap.marketCreatorFee = '10';
      swap.protocolFee = '20';
      const res = service.getFeeInfo(swap);
      expect(res).toEqual({ symbol: '', address: '', fee: '' });
    });

    it('should return correct result for NFT/SYNTH', () => {
      market.baseType = AssetType.ERC721;
      market.quoteType = AssetType.SYNTH;
      swap.marketCreatorFee = '10';
      swap.protocolFee = '20';
      const res = service.getFeeInfo(swap);
      expect(res).toEqual({ symbol: '', address: '', fee: '' });
    });

    it('should return correct result for SYNTH/NFT', () => {
      market.baseType = AssetType.SYNTH;
      market.quoteType = AssetType.ERC721;
      swap.marketCreatorFee = '10';
      swap.protocolFee = '20';
      const res = service.getFeeInfo(swap);
      expect(res).toEqual({ symbol: '', address: '', fee: '' });
    });
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

    describe('when swap has an appealed dispute and includeAllDisputes=true', () => {
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
