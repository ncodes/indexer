import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, providers } from 'ethers';
import * as assetRegABI from '../../abi/AssetRegistry.json';
import * as badgeMgrABI from '../../abi/BadgeManager.json';
import * as coreABI from '../../abi/Core.json';
import * as disputeManagerABI from '../../abi/DisputeManager.json';
import * as erc20TokenABI from '../../abi/ERC20.json';
import * as feePoolABI from '../../abi/FeePool.json';
import * as lpPoolABI from '../../abi/LPPool.json';
import * as marketCoreABI from '../../abi/MarketCore.json';
import * as mediatorManagerABI from '../../abi/MediatorManager.json';
import * as p2pTokenABI from '../../abi/Token.json';
import * as tokenPoolABI from '../../abi/TokenPool.json';
import {
  AssetRegistry,
  BadgeManager,
  Core,
  DisputeManager,
  ERC20,
  FeePool,
  LPPool,
  MarketCore,
  MediatorManager,
  Token,
  TokenPool,
} from '../../typechain';
import { isTestMode } from '../common/common';
import { NotifierService } from '../jobs/mailer/NotifierService';
import Meta, { MetaKeys } from '../models/meta';
import { ExchangeRateService } from '../services/exchange_rate.service';
import { MetadataService } from '../services/metadata/metadata.service';
import { AssetRegistryHandler } from './assetregistry/asset_registry.handler';
import { BadgeManagerHandler } from './badge/badge_manager.handler';
import { CoreHandler } from './core/core.handler';
import { DisputeManagerHandler } from './disputemanager/dispute_manager.handler';
import { FeePoolHandler } from './feepool/fee_pool.handler';
import { LPPoolHandler } from './lppool/lp_pool.handler';
import { MarketCoreHandler } from './marketcore/market_core.handler';
import { MediatorManagerHandler } from './mediatormanager/mediator_manager.handler';
import Processor from './processor';
import { TokenPoolHandler } from './tokenpool/token_pool.handler';
import { Watcher } from './watcher';

@Injectable()
export default class NetworkService {
  private logger = new Logger(NetworkService.name);
  private contracts: JointContracts = {};
  private provider: providers.JsonRpcProvider;

  constructor(
    public cfgSrv: ConfigService,
    private notifSrv: NotifierService,
    @Inject(forwardRef(() => MetadataService))
    private metadataSrv: MetadataService,
    private exrSrv: ExchangeRateService,
  ) {
    if (isTestMode()) return;
    this.watch().catch(this.logger.error);
  }

  /**
   * Watch event
   */
  private async watch() {
    await this.watchNetwork(this.cfgSrv.get('app.network'));
  }

  /**
   * Get contracts linked to a given network
   * @returns
   */
  getContracts() {
    return this.contracts;
  }

  /**
   * Get a network's provider
   * @returns
   */
  getProvider(): providers.JsonRpcProvider {
    return this.provider;
  }

  /**
   * Get an  ERC20 contract
   * @param address The contract address
   */
  getERC20Contract(address: string): ERC20 {
    return new Contract(address, erc20TokenABI, this.provider) as ERC20;
  }

  /**
   * Load initial contracts params for a given network
   * @param network The network name
   */
  private async loadInitialContractParams(network: string) {
    const contractsParams = this.cfgSrv.get(`app.contractsParams`);
    const key = Meta.makeNetKey(network, MetaKeys.ContractsParams);
    const params = await Meta.get(key);
    if (params && params.value) return;
    await Meta.create(key, JSON.stringify(contractsParams));
    this.logger.log('Loaded initial contracts parameters');
  }

  /**
   * Connect and watch contracts.
   * @param network The name of the network
   */
  private async watchNetwork(network: string) {
    this.contracts = {};
    const rpcUrl = this.cfgSrv.get(`app.contractsAddress.rpcUrl`);
    if (!rpcUrl) throw new Error('rpcUrl is not defined');
    const provider = new providers.JsonRpcProvider(rpcUrl);
    this.provider = provider;

    // Initialize contracts
    const p2pTokenAddr = this.cfgSrv.get(`app.contractsAddress.p2pTokenAddr`);
    if (p2pTokenAddr) this.contracts.p2pToken = new Contract(p2pTokenAddr, p2pTokenABI, provider) as Token;

    const marketCoreAddr = this.cfgSrv.get(`app.contractsAddress.marketCoreAddr`);
    if (marketCoreAddr) this.contracts.marketCore = new Contract(marketCoreAddr, marketCoreABI, provider) as MarketCore;

    const coreAddr = this.cfgSrv.get(`app.contractsAddress.coreAddr`);
    if (coreAddr) this.contracts.core = new Contract(coreAddr, coreABI, provider) as Core;

    const mediatorMgr = this.cfgSrv.get(`app.contractsAddress.mediatorMgrAddr`);
    if (mediatorMgr)
      this.contracts.mediatorMgr = new Contract(mediatorMgr, mediatorManagerABI, provider) as MediatorManager;

    const disputeMgrAddr = this.cfgSrv.get(`app.contractsAddress.disputeMgrAddr`);
    if (disputeMgrAddr)
      this.contracts.disputeMgr = new Contract(disputeMgrAddr, disputeManagerABI, provider) as DisputeManager;

    const tokenPoolAddr = this.cfgSrv.get(`app.contractsAddress.tokenPoolAddr`);
    if (tokenPoolAddr) this.contracts.tokenPool = new Contract(tokenPoolAddr, tokenPoolABI, provider) as TokenPool;

    const lpPoolAddr = this.cfgSrv.get(`app.contractsAddress.lpPoolAddr`);
    if (lpPoolAddr) this.contracts.lpPool = new Contract(lpPoolAddr, lpPoolABI, provider) as LPPool;

    const feePoolAddr = this.cfgSrv.get(`app.contractsAddress.feePoolAddr`);
    if (feePoolAddr) this.contracts.feePool = new Contract(feePoolAddr, feePoolABI, provider) as FeePool;

    const badgeMgrAddr = this.cfgSrv.get(`app.contractsAddress.badgeMgrAddr`);
    if (badgeMgrAddr) this.contracts.badgeMgr = new Contract(badgeMgrAddr, badgeMgrABI, provider) as BadgeManager;

    const assetRegAddr = this.cfgSrv.get(`app.contractsAddress.assetRegAddr`);
    if (assetRegAddr) this.contracts.assetRegistry = new Contract(assetRegAddr, assetRegABI, provider) as AssetRegistry;

    // Load initial contract params
    await this.loadInitialContractParams(network);

    // Initialize handlers
    const handlers = [
      new MarketCoreHandler(this, this.notifSrv, provider, network, this.contracts),
      new MediatorManagerHandler(this, this.notifSrv, provider, network, this.contracts),
      new DisputeManagerHandler(this, this.notifSrv, provider, network, this.contracts),
      new CoreHandler(this, this.notifSrv, this.metadataSrv, this.exrSrv, provider, network, this.contracts),
      new BadgeManagerHandler(this, provider, network, this.contracts),
      new TokenPoolHandler(provider, network, this.contracts),
      new LPPoolHandler(provider, network, this.contracts),
      new FeePoolHandler(provider, network, this.contracts),
      new AssetRegistryHandler(provider, network, this.contracts),
    ];

    // Create event processor
    const processor = new Processor(network);
    await processor.add(...handlers);

    // Create event watcher
    const watcher = new Watcher(network, provider, processor);
    await watcher.add(...handlers);
  }
}
