import { Logger } from '@nestjs/common';
import { Contract, ContractInterface, Signer } from 'ethers';
import { Provider } from '@ethersproject/abstract-provider';
import { EventEmitter2 } from 'eventemitter2';

/**
 * Handler handles incoming contract events.
 */
export abstract class Handler extends EventEmitter2 {
  logger = new Logger(Handler.name);

  /**
   * Initialize the handler
   * @param network The network name
   * @param contract The contract to be handled
   */
  protected constructor(public network: string, private contract: Contract) {
    super();
  }

  /**
   * Get contract
   */
  getContract() {
    return this.contract;
  }

  /**
   * Bind listeners
   */
  abstract listen();

  /**
   * Create an ethers.js Contract object
   * @param addressOrName The contract address
   * @param contractInterface The contract ABI
   * @param signerOrProvider The provider or signer
   */
  newContract(
    addressOrName: string,
    contractInterface: ContractInterface,
    signerOrProvider: Signer | Provider,
  ) {
    return new Contract(addressOrName, contractInterface, signerOrProvider);
  }
}
