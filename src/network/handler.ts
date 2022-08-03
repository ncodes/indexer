import { Logger } from '@nestjs/common';
import { Contract, ContractInterface, Signer } from 'ethers';
import { Provider } from '@ethersproject/abstract-provider';
import { EventEmitter2 } from 'eventemitter2';
import { ConfigService } from '@nestjs/config';

/**
 * Handler handles incoming contract events.
 */
export abstract class Handler extends EventEmitter2 {
  logger = new Logger(Handler.name);

  /**
   * Initialize the handler
   * @param cfg The config service
   * @param network The network name
   * @param contract The contract to be handled
   */
  protected constructor(
    public cfg: ConfigService,
    public network: string,
    private contract: Contract,
  ) {
    super();
  }

  /**
   * Get contract parameters
   * @param param The parameter name
   */
  getParam(param: string): string {
    return this.cfg.get(`app.contractsParams.${this.network}.${param}`);
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
