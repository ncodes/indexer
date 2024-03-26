import { Provider } from 'ethers';
import { Transaction } from 'objection';
import NFTOwner from '../../models/nft_owner';
import { ContractCallEvent } from '../common';
import { Handler } from '../handler';
import NetworkService from '../network.service';

export class NFTHandler extends Handler {
  constructor(
    private netSrv: NetworkService,
    private provider: Provider,
    public network: string,
    private contracts: JointContracts,
  ) {
    super(NFTHandler.name, netSrv.cfgSrv, network, contracts.nft);
  }

  /**
   * Listen for events
   */
  listen() {
    this.on(
      'Transfer',
      async (from: string, to: string, tokenId: bigint, event: ContractCallEvent, txn?: Transaction) => {
        return this.onTransfer(from, to, tokenId, event, txn);
      },
    );
  }

  /**
   * Granted badge or path to an address
   * @param from The sender address
   * @param to The receiver address
   * @param tokenId The token ID
   * @param _event The event object
   * @param txn The transaction object
   */
  async onTransfer(from: string, to: string, tokenId: bigint, _event: ContractCallEvent, txn?: Transaction) {
    await NFTOwner.deleteByAddressAndTokenId(from, Number(tokenId), txn);
    await NFTOwner.create({ address: to, tokenId: Number(tokenId) }, txn);
  }
}
