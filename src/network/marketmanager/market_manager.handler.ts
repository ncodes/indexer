import { Provider } from 'ethers';
import { Transaction } from 'objection';
import PayRouterRequest from '../../models/pay_router_request';
import { ContractCallEvent } from '../common';
import { Handler } from '../handler';

export class MarketManagerHandler extends Handler {
  constructor(private provider: Provider, public network: string, private contracts: JointContracts) {
    super(MarketManagerHandler.name, null, network, contracts.marketManager);
  }

  /**
   * Listen for events
   */
  listen() {
    this.on(
      'RequestCreated',
      async (requestId: bigint, orderId: bigint, event: ContractCallEvent, txn?: Transaction) => {
        return this.onRequestCreated(requestId, orderId, event, txn);
      },
    );
  }

  /**
   * A PayRouter request has been created
   * @param requestId The request ID
   * @param orderId The route ID
   * @param _event The event object
   * @param txn The transaction object
   */
  async onRequestCreated(requestId: bigint, orderId: bigint, _event: ContractCallEvent, txn?: Transaction) {
    const request = await PayRouterRequest.findByNetworkAndRequestId(this.network, Number(requestId), txn);
    await PayRouterRequest.updateById(request.id, { orderId: Number(orderId) }, txn);
  }
}
