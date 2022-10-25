import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BigNumber, Contract, providers } from 'ethers';
import * as coreABI from '../../abi/core.json';
import * as disputeManagerABI from '../../abi/disputemanager.json';
import * as feePoolABI from '../../abi/feepool.json';
import * as lpPoolABI from '../../abi/lppool.json';
import * as marketCoreABI from '../../abi/marketcore.json';
import * as erc20ABI from '../../abi/erc20.json';
import * as mediatorManagerABI from '../../abi/mediatormanager.json';
import * as tokenPoolABI from '../../abi/tokenpool.json';
import * as p2pTokenABI from '../../abi/token.json';
import { SupportedNetworks } from './common';
import { CoreHandler } from './core/core.handler';
import { DisputeManagerHandler } from './disputemanager/dispute_manager.handler';
import { FeePoolHandler } from './feepool/fee_pool.handler';
import { LPPoolHandler } from './lppool/lp_pool.handler';
import { MarketCoreHandler } from './marketcore/market_core.handler';
import { MediatorManagerHandler } from './mediatormanager/mediator_manager.handler';
import { TokenPoolHandler } from './tokenpool/token_pool.handler';
import { NotifierService } from '../jobs/mailer/NotifierService';
import Swap from '../models/swap';
import { Transaction } from 'objection';
import Market from '../models/market';
import Meta, { FeeName } from '../models/meta';
import { isTestMode } from '../common/common';
import { Signer } from '@ethersproject/abstract-signer';
import { Provider } from '@ethersproject/abstract-provider';
import { ContractInterface } from '@ethersproject/contracts/src.ts';
import { Watcher } from './watcher';

@Injectable()
export default class NetworkService {
  private contracts: {
    [key: string]: KnownContracts;
  } = {};
  private providers: {
    [key: string]: providers.JsonRpcProvider;
  } = {};

  constructor(public cfgSrv: ConfigService, private notifSrv: NotifierService) {
    if (isTestMode()) return;
    this.watch();
  }

  /**
   * Watch events on different networks
   */
  async watch() {
    await this.watchNetwork(SupportedNetworks.Localhost);
    // await this.watchNetwork(SupportedNetworks.Ethereum);
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
   * Get a network's provider
   * @param network The network name
   * @returns
   */
  getProvider(network: string): providers.JsonRpcProvider {
    return this.providers[network];
  }

  /**
   * Connect and watch contracts on the Ethereum mainnet.
   * @param network The name of the network
   */
  async watchNetwork(network: string) {
    const prov = new providers.JsonRpcProvider(this.cfgSrv.get(`app.networks.${network}.rpcUrl`));

    this.contracts[network] = {};
    this.providers[network] = prov;

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
      mediatorManagerABI,
      prov,
    );
    this.contracts[network].disputeMgr = new Contract(
      this.cfgSrv.get(`app.networks.${network}.disputeMgrAddr`),
      disputeManagerABI,
      prov,
    );
    this.contracts[network].tokenPool = new Contract(
      this.cfgSrv.get(`app.networks.${network}.tokenPoolAddr`),
      tokenPoolABI,
      prov,
    );
    this.contracts[network].lpPool = new Contract(
      this.cfgSrv.get(`app.networks.${network}.lpPoolAddr`),
      lpPoolABI,
      prov,
    );
    this.contracts[network].feePool = new Contract(
      this.cfgSrv.get(`app.networks.${network}.feePoolAddr`),
      feePoolABI,
      prov,
    );

    const watcher = new Watcher(network, prov);

    // Add handlers to watcher
    await watcher.add(
      new MarketCoreHandler(this, this.notifSrv, prov, network, this.contracts[network]),
      new CoreHandler(this, this.notifSrv, prov, network, this.contracts[network]),
      new MediatorManagerHandler(this, this.notifSrv, prov, network, this.contracts[network]),
      new DisputeManagerHandler(this, this.notifSrv, prov, network, this.contracts[network]),
      new TokenPoolHandler(prov, network, this.contracts[network]),
      new LPPoolHandler(prov, network, this.contracts[network]),
      new FeePoolHandler(prov, network, this.contracts[network]),
    );
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
  ): Promise<number> {
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
    let feeName: FeeName = FeeName.SynthSwapFee;
    if (swap.instant) {
      const baseStable = await Meta.isStableAsset(swap.network, market.baseAddress, txn);
      const quoteStable = await Meta.isStableAsset(swap.network, market.quoteAddress, txn);
      feeName = baseStable && quoteStable ? FeeName.StableSwapFee : FeeName.InstantSwapFee;
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
