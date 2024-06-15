import { BaseContract, Provider } from 'ethers';
import { Transaction } from 'objection';
import NFTOwner from '../../models/nft_owner';
import { ContractCallEvent } from '../common';
import { Handler } from '../handler';
import NetworkService from '../network.service';
import UniUser from '../../models/uni_user';

export class UniswapRouter extends Handler {
  constructor(
    private netSrv: NetworkService,
    private provider: Provider,
    public network: string,
    contract: BaseContract,
  ) {
    super(UniswapRouter.name, netSrv.cfgSrv, network, contract);
  }

  /**
   * Listen for events
   */
  listen() {
    this.on(
      'Swap',
      async (
        sender: string,
        amount0In: bigint,
        amount1In: bigint,
        amount0Out: bigint,
        amount1Out: bigint,
        to: string,
        event: ContractCallEvent,
        txn?: Transaction,
      ) => {
        return this.onSwap(sender, amount0In, amount1In, amount0Out, amount1Out, to, event, txn);
      },
    );
  }

  /**
   * Granted badge or path to an address
   */
  async onSwap(
    _sender: string,
    _amount0In: bigint,
    _amount1In: bigint,
    _amount0Out: bigint,
    _amount1Out: bigint,
    to: string,
    _event: ContractCallEvent,
    txn?: Transaction,
  ) {
    const existing = await UniUser.getByAddress(to);
    if (!existing) {
      await UniUser.create({ address: to }, txn);
    }
  }
}
