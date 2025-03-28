import { Logger } from '@nestjs/common';
import { Provider } from 'ethers';
import { Transaction } from 'objection';
import Liquidity from '../../models/liquidity';
import { ContractCallEvent, toNumber } from '../common';
import { Handler } from '../handler';

export class ProxyLPHandler extends Handler {
  logger = new Logger(ProxyLPHandler.name);

  constructor(private provider: Provider, public network: string, private contracts: JointContracts) {
    super(ProxyLPHandler.name, null, network, contracts.proxyLP);
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
   * @param event The event object containing transaction details.
   * @param txn (Optional) The transaction object for database updates.
   */
  async onUpdatedFungibleLiquidity(
    marketAddress: string,
    lid: bigint,
    owner: string,
    amount: bigint,
    event: ContractCallEvent,
    txn?: Transaction,
  ) {
    const liq = await Liquidity.getLiquidity(
      this.network,
      marketAddress,
      event.address,
      toNumber(lid),
      undefined,
      undefined,
      txn,
    );

    await Liquidity.updateById(liq.id, { proxy: event.address, proxyProvider: owner }, txn);
  }
}
