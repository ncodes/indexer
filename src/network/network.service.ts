import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, providers } from 'ethers';
import * as coreABI from '../../abi/Core.json';
import * as disputeManagerABI from '../../abi/DisputeManager.json';
import * as feePoolABI from '../../abi/FeePool.json';
import * as badgeMgrABI from '../../abi/BadgeManager.json';
import * as assetRegABI from '../../abi/AssetRegistry.json';
import * as lpPoolABI from '../../abi/LPPool.json';
import * as marketCoreABI from '../../abi/MarketCore.json';
import * as mediatorManagerABI from '../../abi/MediatorManager.json';
import * as tokenPoolABI from '../../abi/TokenPool.json';
import * as p2pTokenABI from '../../abi/Token.json';
import * as erc20TokenABI from '../../abi/ERC20.json';
import { SupportedNetworks } from './common';
import { CoreHandler } from './core/core.handler';
import { DisputeManagerHandler } from './disputemanager/dispute_manager.handler';
import { FeePoolHandler } from './feepool/fee_pool.handler';
import { LPPoolHandler } from './lppool/lp_pool.handler';
import { MarketCoreHandler } from './marketcore/market_core.handler';
import { MediatorManagerHandler } from './mediatormanager/mediator_manager.handler';
import { NotifierService } from '../jobs/mailer/NotifierService';
import { isTestMode } from '../common/common';
import { Watcher } from './watcher';
import { BadgeManagerHandler } from './badge/badge_manager.handler';
import { AssetRegistryHandler } from './assetregistry/asset_registry.handler';
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
import Meta, { MetaKeys } from '../models/meta';
import { MetadataService } from '../services/metadata/metadata.service';
import { ExchangeRateService } from '../services/exchange_rate.service';

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
   * @param network The network name
   * @param address The contract address
   */
  getERC20Contract(network: string, address: string): ERC20 {
    return new Contract(address, erc20TokenABI, this.provider[network]) as ERC20;
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
    this.contracts[network] = {};
    const prov = new providers.JsonRpcProvider(this.cfgSrv.get(`app.contractsAddress.rpcUrl`));
    this.provider = prov;

    // Initialize contracts
    this.contracts[network].p2pToken = new Contract(
      this.cfgSrv.get(`app.contractsAddress.p2pTokenAddr`),
      p2pTokenABI,
      prov,
    ) as Token;
    this.contracts[network].marketCore = new Contract(
      this.cfgSrv.get(`app.contractsAddress.marketCoreAddr`),
      marketCoreABI,
      prov,
    ) as MarketCore;
    this.contracts[network].core = new Contract(
      this.cfgSrv.get(`app.contractsAddress.coreAddr`),
      coreABI,
      prov,
    ) as Core;
    this.contracts[network].mediatorMgr = new Contract(
      this.cfgSrv.get(`app.contractsAddress.mediatorMgrAddr`),
      mediatorManagerABI,
      prov,
    ) as MediatorManager;
    this.contracts[network].disputeMgr = new Contract(
      this.cfgSrv.get(`app.contractsAddress.disputeMgrAddr`),
      disputeManagerABI,
      prov,
    ) as DisputeManager;
    this.contracts[network].tokenPool = new Contract(
      this.cfgSrv.get(`app.contractsAddress.tokenPoolAddr`),
      tokenPoolABI,
      prov,
    ) as TokenPool;
    this.contracts[network].lpPool = new Contract(
      this.cfgSrv.get(`app.contractsAddress.lpPoolAddr`),
      lpPoolABI,
      prov,
    ) as LPPool;
    this.contracts[network].feePool = new Contract(
      this.cfgSrv.get(`app.contractsAddress.feePoolAddr`),
      feePoolABI,
      prov,
    ) as FeePool;
    this.contracts[network].badgeMgr = new Contract(
      this.cfgSrv.get(`app.contractsAddress.badgeMgrAddr`),
      badgeMgrABI,
      prov,
    ) as BadgeManager;
    this.contracts[network].assetRegistry = new Contract(
      this.cfgSrv.get(`app.contractsAddress.assetRegAddr`),
      assetRegABI,
      prov,
    ) as AssetRegistry;

    // Load initial contract params
    await this.loadInitialContractParams(network);

    // Add handlers to watcher
    const watcher = new Watcher(network, prov);
    await watcher.add(
      new MarketCoreHandler(this, this.notifSrv, prov, network, this.contracts[network]),
      new MediatorManagerHandler(this, this.notifSrv, prov, network, this.contracts[network]),
      new DisputeManagerHandler(this, this.notifSrv, prov, network, this.contracts[network]),
      new CoreHandler(this, this.notifSrv, this.metadataSrv, this.exrSrv, prov, network, this.contracts[network]),
      new BadgeManagerHandler(prov, network, this.contracts[network]),
      // new TokenPoolHandler(prov, network, this.contracts[network]),
      new LPPoolHandler(prov, network, this.contracts[network]),
      new FeePoolHandler(prov, network, this.contracts[network]),
      new AssetRegistryHandler(prov, network, this.contracts[network]),
    );
  }
}
