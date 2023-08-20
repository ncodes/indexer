import { Logger } from "@nestjs/common";
import { Contract, ContractInterface, providers, Signer } from "ethers";
import * as erc20ABI from "../../abi/ERC20.json";
import { Provider } from "@ethersproject/abstract-provider";
import { EventEmitter2 } from "eventemitter2";
import { ConfigService } from "@nestjs/config";
import Meta from "../models/meta";

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
  protected constructor(
    public name: string,
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
  async getParam(param: keyof ContractsParams): Promise<string> {
    return Meta.getContractParam(this.network, param);
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
  newContract(addressOrName: string, contractInterface: ContractInterface, signerOrProvider: Signer | Provider) {
    return new Contract(addressOrName, contractInterface, signerOrProvider);
  }

  /**
   * Get token decimals
   * @param provider The network provider
   * @param token The token address
   */
  public async getTokenDecimals(provider: providers.JsonRpcProvider, token: string): Promise<number> {
    const base = this.newContract(token, erc20ABI, provider);
    return base.decimals();
  }
}
