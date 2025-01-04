import { Wallet } from 'ethers';
import { DBService } from '../db/db.service';
import AssetRegistry from '../models/asset_registry';
import Market, { AssetType } from '../models/market';
import Meta, { FeeName, MetaKeys } from '../models/meta';
import { powOf } from '../network/common';
import { FeeCalculatorService } from './fee_calculator.service';

describe('FeeCalculatorService', () => {
  const marketAddress = Wallet.createRandom().address;
  const BASE = 'BASE';
  const QUOTE = 'QUOTE';
  const baseAddress = '0xBase';
  const quoteAddress = '0xQuote';
  const db = DBService.getForTest();
  const net = 'ethereum';
  let srv: FeeCalculatorService;
  const defaultParams = {
    network: net,
    marketAddress: '0xMarket',
    lid: '',
    orderAmount: '',
    orderPrice: '',
    provider: '',
    taker: '',
  };

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.truncateTables();

    srv = new FeeCalculatorService();

    await Meta.create(Meta.makeNetKey(net, MetaKeys.ContractsParams), JSON.stringify({}));

    await Meta.create(Meta.makeNetKey(net, FeeName.InstantSwapFeeBp), '12');
    await Meta.create(Meta.makeNetKey(net, FeeName.SynthSwapFeeBp), '14');
    await Meta.create(Meta.makeNetKey(net, FeeName.StableSwapFeeBp), '10');
    await Meta.create(Meta.makeNetKey(net, FeeName.InstantNFTSwapFeeBp), '10');
  });

  describe('.calculateFee', () => {
    it('should reject if market does not exist', async () => {
      await expect(srv.calculateFee({ ...defaultParams })).rejects.toThrowError('market not found');
    });

    describe('ERC20/ERC20', () => {
      let market: Market;

      beforeEach(async () => {
        market = await Market.create({
          network: net,
          address: marketAddress,
          base: BASE,
          baseAddress,
          baseType: AssetType.ERC20,
          baseDecimals: 18,
          quote: QUOTE,
          quoteAddress,
          quoteType: AssetType.ERC20,
          quoteDecimals: 18,
        });
      });

      it('should calculate fees correctly', async () => {
        await Meta.update(Meta.makeNetKey(net, FeeName.InstantSwapFeeBp), '14');
        await Market.updateById(market.id, { commission: 1000 });
        const amount = powOf(5, 18).toString();
        await expect(srv.calculateFee({ ...defaultParams, marketAddress, orderAmount: amount })).resolves.toEqual({
          protoFee: '7000000000000000',
          mktCreatorFee: '500000000000000000',
          feeBp: 14,
          mktFeeBp: 1000,
        });
      });

      describe('both assets are stables', () => {
        it('should calculate fees correctly', async () => {
          await AssetRegistry.create({ network: net, address: baseAddress, stable: true });
          await AssetRegistry.create({ network: net, address: quoteAddress, stable: true });
          await Meta.update(Meta.makeNetKey(net, FeeName.StableSwapFeeBp), '14');
          await Market.updateById(market.id, { commission: 1000 });
          const amount = powOf(5, 18).toString();
          await expect(srv.calculateFee({ ...defaultParams, marketAddress, orderAmount: amount })).resolves.toEqual({
            protoFee: '7000000000000000',
            mktCreatorFee: '500000000000000000',
            feeBp: 14,
            mktFeeBp: 1000,
          });
        });
      });
    });

    describe('ERC20/NATIVE', () => {
      let market: Market;

      beforeEach(async () => {
        market = await Market.create({
          network: net,
          address: marketAddress,
          base: BASE,
          baseAddress,
          baseType: AssetType.ERC20,
          baseDecimals: 18,
          quote: QUOTE,
          quoteAddress,
          quoteType: AssetType.NATIVE,
          quoteDecimals: 18,
        });
      });

      it('should calculate fees correctly', async () => {
        await Meta.update(Meta.makeNetKey(net, FeeName.InstantSwapFeeBp), '14');
        await Market.updateById(market.id, { commission: 1000 });
        const amount = powOf(5, 18).toString();
        await expect(srv.calculateFee({ ...defaultParams, marketAddress, orderAmount: amount })).resolves.toEqual({
          protoFee: '7000000000000000',
          mktCreatorFee: '500000000000000000',
          feeBp: 14,
          mktFeeBp: 1000,
        });
      });
    });

    describe('ERC20/SYNTH', () => {
      let market: Market;

      beforeEach(async () => {
        market = await Market.create({
          network: net,
          address: marketAddress,
          base: BASE,
          baseAddress,
          baseType: AssetType.ERC20,
          baseDecimals: 18,
          quote: QUOTE,
          quoteAddress,
          quoteType: AssetType.SYNTH,
          quoteDecimals: 18,
        });
      });

      it('should calculate fees correctly', async () => {
        await Meta.update(Meta.makeNetKey(net, FeeName.SynthSwapFeeBp), '14');
        await Market.updateById(market.id, { commission: 1000 });
        const amount = powOf(5, 18).toString();
        const orderPrice = powOf(10, 18).toString();
        await expect(
          srv.calculateFee({ ...defaultParams, marketAddress, orderAmount: amount, orderPrice }),
        ).resolves.toEqual({
          protoFee: '7000000000000000',
          mktCreatorFee: '500000000000000000',
          feeBp: 14,
          mktFeeBp: 1000,
        });
      });
    });

    describe('SYNTH/ERC20', () => {
      let market: Market;

      beforeEach(async () => {
        market = await Market.create({
          network: net,
          address: marketAddress,
          base: BASE,
          baseAddress,
          baseType: AssetType.SYNTH,
          baseDecimals: 18,
          quote: QUOTE,
          quoteAddress,
          quoteType: AssetType.ERC20,
          quoteDecimals: 18,
        });
      });

      it('should calculate fees correctly', async () => {
        await Meta.update(Meta.makeNetKey(net, FeeName.SynthSwapFeeBp), '14');
        await Market.updateById(market.id, { commission: 1000 });
        const amount = powOf(5, 18).toString();
        const orderPrice = powOf(10, 18).toString();
        await expect(
          srv.calculateFee({ ...defaultParams, marketAddress, orderAmount: amount, orderPrice }),
        ).resolves.toEqual({
          protoFee: '70000000000000000',
          mktCreatorFee: '5000000000000000000',
          feeBp: 14,
          mktFeeBp: 1000,
        });
      });
    });

    describe('ERC20/NFT', () => {
      let market: Market;

      beforeEach(async () => {
        market = await Market.create({
          network: net,
          address: marketAddress,
          base: BASE,
          baseAddress,
          baseType: AssetType.ERC20,
          baseDecimals: 18,
          quote: QUOTE,
          quoteAddress,
          quoteType: AssetType.ERC721,
          quoteDecimals: 18,
        });
      });

      it('should calculate fees correctly', async () => {
        await Meta.update(Meta.makeNetKey(net, FeeName.InstantNFTSwapFeeBp), '14');
        await Market.updateById(market.id, { commission: 1000 });
        const amount = powOf(100, 18).toString();
        await expect(srv.calculateFee({ ...defaultParams, marketAddress, orderAmount: amount })).resolves.toEqual({
          protoFee: '140000000000000000',
          mktCreatorFee: '10000000000000000000',
          feeBp: 14,
          mktFeeBp: 1000,
        });
      });
    });

    describe('NFT/ERC20', () => {
      let market: Market;

      beforeEach(async () => {
        market = await Market.create({
          network: net,
          address: marketAddress,
          base: BASE,
          baseAddress,
          baseType: AssetType.ERC721,
          baseDecimals: 18,
          quote: QUOTE,
          quoteAddress,
          quoteType: AssetType.ERC20,
          quoteDecimals: 18,
        });
      });

      it('should calculate fees correctly', async () => {
        await Meta.update(Meta.makeNetKey(net, FeeName.InstantNFTSwapFeeBp), '14');
        await Market.updateById(market.id, { commission: 1000 });
        const price = powOf(10, 18).toString();
        await expect(
          srv.calculateFee({ ...defaultParams, marketAddress, orderAmount: '0', orderPrice: price }),
        ).resolves.toEqual({
          protoFee: '14000000000000000',
          mktCreatorFee: '1000000000000000000',
          feeBp: 14,
          mktFeeBp: 1000,
        });
      });
    });
  });
});
