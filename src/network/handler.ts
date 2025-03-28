import { Abi } from '@jointlabs/meta';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseContract, Contract, InterfaceAbi, Provider, Signer } from 'ethers';
import { EventEmitter2 } from 'eventemitter2';
import Meta from '../models/meta';

/**
 * Handler handles incoming contract events.
 */
export abstract class Handler extends EventEmitter2 {
  logger = new Logger(this.name);

  /**
   * Initialize the handler
   * @param name The name of the handler
   * @param cfg The config service
   * @param network The network name
   * @param contract The contract to be handled
   */
  protected constructor(public name: string, public cfg: ConfigService, public network: string, private contract: any) {
    super();
  }

  /**
   * Get contract parameters
   * @param param The parameter name
   */
  async getParam(param: keyof ContractsParams): Promise<string> {
    return (await Meta.getContractParam(this.network, param)) as string;
  }

  /**
   * Get contract
   */
  getContract(): BaseContract {
    return this.contract as BaseContract;
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
  newContract(addressOrName: string, contractInterface: InterfaceAbi, signerOrProvider: Signer | Provider) {
    return new Contract(addressOrName, contractInterface, signerOrProvider);
  }

  /**
   * Get token decimals
   * @param provider The network provider
   * @param token The token address
   */
  public async getTokenDecimals(provider: Provider, token: string): Promise<number> {
    const base = this.newContract(token, Abi.ERC20, provider);
    return base.decimals();
  }
}
