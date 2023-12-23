import { BigNumber, ethers, Event, providers } from 'ethers';
import { Transaction } from 'objection';
import { Handler } from '../handler';
import NetworkService from '../network.service';

export class NFTHandler extends Handler {
  constructor(
    private netSrv: NetworkService,
    private provider: providers.JsonRpcProvider,
    public network: string,
    private contracts: JointContracts,
  ) {
    super(NFTHandler.name, netSrv.cfgSrv, network, contracts.nft);
  }

  /**
   * Listen for events
   */
  listen() {
    this.on('Transfer', async (from: string, to: string, tokenId: BigNumber, event: Event, txn?: Transaction) => {
      return this.onTransfer(from, to, tokenId, event, txn);
    });
  }

  /**
   * Granted badge or path to an address
   * @param from The sender address
   * @param to The receiver address
   * @param tokenId The token ID
   * @param _event The event object
   * @param txn The transaction object
   */
  async onTransfer(from: string, to: string, tokenId: BigNumber, _event: ethers.Event, txn?: Transaction) {
    await this.netSrv.pointSrv.grantOnNFTOwnership(this.network, to, tokenId.toNumber(), txn);
  }
}
