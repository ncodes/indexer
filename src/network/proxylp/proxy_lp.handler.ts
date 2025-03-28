import { Logger } from '@nestjs/common';
import * as _ from 'lodash';
import { Transaction } from 'objection';
import Liquidity from '../../models/liquidity';
import { ContractCallEvent, toNumber } from '../common';
import { Handler } from '../handler';
import NetworkService from '../network.service';

export class ProxyLPHandler extends Handler {
  logger = new Logger(ProxyLPHandler.name);

  constructor(private netSrv: NetworkService, public network: string, private contracts: JointContracts) {
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
   * Handles the UpdatedFungibleLiquidity event from the ProxyLP contract.
   * This event indicates that liquidity has been updated via ProxyLP.
   * @param marketAddress The market ID where the liquidity is updated.
   * @param lid The unique liquidity ID associated with the update.
   * @param owner The original liquidity provider who added liquidity via ProxyLP.
   * @param amount The updated amount of liquidity.
   * @param _event The event object containing transaction details.
   * @param txn (Optional) The transaction object for database updates.
   */
  async onUpdatedFungibleLiquidity(
    marketAddress: string,
    lid: bigint,
    owner: string,
    amount: bigint,
    _event: ContractCallEvent,
    txn?: Transaction,
  ) {
    const proxyAddress = _event.address;

    const liq = await Liquidity.getLiquidity(
      this.network,
      marketAddress,
      undefined,
      toNumber(lid),
      undefined,
      undefined,
      txn,
    );

    const liqUpdates: Partial<Liquidity> = {};

    liqUpdates.proxy = proxyAddress;
    liqUpdates.proxyProvider = owner;
    liqUpdates.amount = amount.toString();
    liqUpdates.provider = owner;

    await Liquidity.updateById(liq.id, liqUpdates, txn);
  }
}
