import { Logger } from '@nestjs/common';
import * as _ from 'lodash';
import { Transaction } from 'objection';
import { toDec } from '../../common/common';
import Event, { Events } from '../../models/event';
import Liquidity, { makeLiqAddress } from '../../models/liquidity';
import Market from '../../models/market';
import { ContractCallEvent, isZero, toNumber } from '../common';
import { Handler } from '../handler';
import NetworkService from '../network.service';

export class ProxyLPHandler extends Handler {
  logger = new Logger(ProxyLPHandler.name);

  constructor(
    private netSrv: NetworkService,
    public network: string,
    private contracts: JointContracts,
  ) {
    super(ProxyLPHandler.name, netSrv.cfgSrv, network, contracts.core);
  }

  /**
   * Listen for events
   */
  listen() {
    this.on(
      'UpdatedFungibleLiquidity',
      async (
        marketAddress: string,
        lid: bigint,
        owner: string,
        amount: bigint,
        event: ContractCallEvent,
        txn: Transaction,
      ) => {
        return this.onUpdatedFungibleLiquidity(marketAddress, lid, owner, amount, event, txn);
      },
    );
  }

  /**
   * Fungible market liquidity was updated
   * @param provider The liquidity owner address
   * @param marketAddress The market ID
   * @param target The target of the liquidity
   * @param deduct Indicate whether the liquidity is deducted from
   * @param paused Indicate whether the liquidity is paused
   * @param lid The liquidity ID
   * @param amount The current amount of liquidity
   * @param price The latest price
   * @param wantOrIds A list of OR IDs wanted
   * @param wantAndIds A list of AND IDs wanted
   * @param timeToPay The number of seconds within which payment must be received
   * @param _event The event object
   * @param txn The transaction object
   */
  async onUpdatedFungibleLiquidity(
    marketAddress: string,
    lid: bigint,
    owner: string,
    amount: bigint,
    _event: ContractCallEvent,
    txn?: Transaction,
  ) {
    let liq = await Liquidity.getLiquidity(
      this.network,
      marketAddress,
      owner,
      toNumber(lid),
      undefined,
      undefined,
      txn,
    );

    let market = await Market.getMarket(this.network, marketAddress, undefined, undefined, true, txn);

    const common = {
      network: this.network,
      marketAddress,
      provider: owner,
      lid: toNumber(lid),
      creator: owner,
    };

    if (!liq) {
      liq = await Liquidity.create(
        {
          network: this.network,
          marketAddress: marketAddress,
          provider: owner,
          lid: toNumber(lid),
          address: makeLiqAddress(marketAddress, owner, toNumber(lid)),
          base: market.base,
          baseAddress: market.baseAddress,
          baseType: market.baseType,
          quote: market.quote,
          quoteAddress: market.quoteAddress,
          quoteType: market.quoteType,
          amount: amount.toString(),
        },
        txn,
      );

      // Update market
      market = await Market.updateById(
        market.id,
        { lowestPrice: await Liquidity.getLowestPrice(this.network, marketAddress, undefined, undefined, txn) },
        txn,
      );

      await Event.create({ ...common, action: Events.LiquidityAdd, amount: liq.amount }, txn);
    } else {
      const liqUpdates: Partial<Liquidity> = {};
      const marketUpdates: Partial<Market> = {};

      if (!isZero(amount)) {
        liqUpdates.amount = toDec(liq.amount).add(amount.toString()).toFixed();
        await Event.create({ ...common, amount: amount.toString(), action: Events.LiquidityAdd }, txn);
      }

      await Liquidity.updateById(liq.id, liqUpdates, txn);

      marketUpdates.lowestPrice = await Liquidity.getLowestPrice(this.network, marketAddress, undefined, undefined, txn);
      await Market.updateById(market.id, marketUpdates, txn);
    }
  }
}
