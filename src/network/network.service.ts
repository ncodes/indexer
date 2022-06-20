import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BigNumber, Contract, providers } from 'ethers';
import * as coreABI from '../../abi/core.json';
import * as disputeManagerABI from '../../abi/disputemanager.json';
import * as feeSharerABI from '../../abi/feesharer.json';
import * as lpStakerABI from '../../abi/lpstaker.json';
import * as marketCoreABI from '../../abi/marketcore.json';
import * as erc20ABI from '../../abi/erc20.json';
import * as marketManagerABI from '../../abi/marketmanager.json';
import * as p2pStakerABI from '../../abi/p2pstaker.json';
import * as p2pTokenABI from '../../abi/p2ptoken.json';
import { SupportedNetworks } from './common';
import { CoreHandler } from './core/core.handler';
import { DisputeManagerHandler } from './disputemanager/dispute_manager.handler';
import { FeeSharerHandler } from './feesharer/fee_sharer.handler';
import { LPStakerHandler } from './lpstaker/lp_staker.handler';
import { MarketCoreHandler } from './marketcore/market_core.handler';
import { MediatorManagerHandler } from './mediatormanager/mediator_manager.handler';
import { P2PStakerHandler } from './p2pstaker/p2p_staker.handler';
import { NotifierService } from '../jobs/mailer/NotifierService';
import Swap from '../models/swap';
import { Transaction } from 'objection';
import Market from '../models/market';
import Meta from '../models/meta';
import { isTestMode } from '../common/common';
import { Signer } from '@ethersproject/abstract-signer';
import { Provider } from '@ethersproject/abstract-provider';
import { ContractInterface } from '@ethersproject/contracts/src.ts';

@Injectable()
export default class NetworkService {
  private contracts: {
    [key: string]: KnownContracts;
  } = {};

  constructor(private cfgSrv: ConfigService, private notifSrv: NotifierService) {
    if (isTestMode()) return;
    this.watch();
  }

  /**
   * Watch events on different networks
   */
  watch() {
    this.watchNetwork(SupportedNetworks.EthereumMainnet);
  }

  /**
   * Get contracts linked to a given network
   * @param network The network name
   * @returns
   */
  getContracts(network: string) {
    return this.contracts[network];
  }

  /**
   * Get market core contract
   * @param network The network name
   * @returns
   */
  getMarketCore(network: string) {
    return this.getContracts(network).marketCore;
  }

  /**
   * Get market core contract
   * @param network The network name
   * @returns
   */
  getCore(network: string) {
    return this.getContracts(network).core;
  }

  /**
   * Connect and watch contracts on the Ethereum mainnet.
   * @param network The name of the network
   */
  async watchNetwork(network: string) {
    const prov = new providers.JsonRpcProvider(this.cfgSrv.get(`app.networks.${network}.rpcUrl`));

    this.contracts[network] = {};

    // Initialize contracts
    this.contracts[network].p2pToken = new Contract(
      this.cfgSrv.get(`app.networks.${network}.p2pTokenAddr`),
      p2pTokenABI,
      prov,
    );
    this.contracts[network].marketCore = new Contract(
      this.cfgSrv.get(`app.networks.${network}.marketCoreAddr`),
      marketCoreABI,
      prov,
    );
    this.contracts[network].core = new Contract(
      this.cfgSrv.get(`app.networks.${network}.coreAddr`),
      coreABI,
      prov,
    );
    this.contracts[network].mediatorMgr = new Contract(
      this.cfgSrv.get(`app.networks.${network}.mediatorMgrAddr`),
      marketManagerABI,
      prov,
    );
    this.contracts[network].disputeMgr = new Contract(
      this.cfgSrv.get(`app.networks.${network}.disputeMgrAddr`),
      disputeManagerABI,
      prov,
    );
    this.contracts[network].p2pStaker = new Contract(
      this.cfgSrv.get(`app.networks.${network}.p2pStakerAddr`),
      p2pStakerABI,
      prov,
    );
    this.contracts[network].lpStaker = new Contract(
      this.cfgSrv.get(`app.networks.${network}.lpStakerAddr`),
      lpStakerABI,
      prov,
    );
    this.contracts[network].feeSharer = new Contract(
      this.cfgSrv.get(`app.networks.${network}.feeSharerAddr`),
      feeSharerABI,
      prov,
    );

    // Listen for events
    new MarketCoreHandler(this, this.notifSrv, prov, network, this.contracts[network]).listen();
    new CoreHandler(this, this.notifSrv, prov, network, this.contracts[network]).listen();
    new MediatorManagerHandler(prov, network, this.contracts[network]).listen();
    new DisputeManagerHandler(prov, network, this.contracts[network]).listen();
    new P2PStakerHandler(prov, network, this.contracts[network]).listen();
    new LPStakerHandler(prov, network, this.contracts[network]).listen();
    new FeeSharerHandler(prov, network, this.contracts[network]).listen();
  }

  /**
   * Create instance of Contract
   * @param addressOrName The contract address
   * @param contractInterface The contract ABI
   * @param signerOrProvider The network provider
   */
  public newContract(
    addressOrName: string,
    contractInterface: ContractInterface,
    signerOrProvider?: Signer | Provider,
  ) {
    return new Contract(addressOrName, contractInterface, signerOrProvider);
  }

  /**
   * Get token decimals
   * @param provider The network provider
   * @param token The token address
   */
  public async getTokenDecimals(
    provider: providers.JsonRpcProvider,
    token: string,
  ): Promise<BigNumber> {
    const base = this.newContract(token, erc20ABI, provider);
    return base.decimals();
  }

  /**
   * Get swap fee information
   * @param provider The provider object
   * @param swap The swap object
   * @param txn The transaction object
   * @return
   */
  async getSwapFeeInfo(
    provider: providers.JsonRpcProvider,
    swap: Swap,
    txn?: Transaction,
  ): Promise<{
    cost: string;
    chargedAmount: string;
    costCharged: boolean;
    protocolFeeBP: number;
    protocolFee: string;
    marketFee: string;
    marketFeeBP: number;
    totalFee: string;
  }> {
    const market = await Market.getMarket(swap.network, swap.marketId);
    if (!market) return Promise.reject(new Error('market not found'));

    // Calculate commission
    const baseDec = await this.getTokenDecimals(provider, market.baseAddress);
    const cost = BigNumber.from(swap.price).mul(swap.amount).div(BigNumber.from(10).pow(baseDec));
    const chargeable = market.isBaseLocal ? cost : BigNumber.from(swap.amount);
    const commission = chargeable.mul(market.commission).div(10000);

    // Determine what protocol fee base point
    let feeName = 'p2pSwapFee';
    if (swap.instant) {
      const baseStable = await Meta.isStableAsset(swap.network, market.baseAddress, txn);
      const quoteStable = await Meta.isStableAsset(swap.network, market.quoteAddress, txn);
      feeName = baseStable && quoteStable ? 'stableSwapFee' : 'instantSwapFee';
    }

    // Calculate protocol and market fees
    const feeBP = await Meta.getProtocolFee(swap.network, feeName);
    const fee = chargeable.mul(feeBP.value).div(10000);
    return Promise.resolve({
      cost: cost.toString(),
      chargedAmount: chargeable.toString(),
      costCharged: market.isBaseLocal,
      protocolFeeBP: parseInt(feeBP.value),
      protocolFee: fee.toString(),
      totalFee: commission.add(fee).toString(),
      marketFeeBP: market.commission,
      marketFee: commission.toString(),
    });
  }
}
