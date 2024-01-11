import { ChainNames } from '@jointlabs/chains-info';
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
import * as nftABI from '../../abi/NFT.json';
import * as p2pTokenABI from '../../abi/Token.json';
import * as tokenPoolABI from '../../abi/TokenPool.json';
import {
  AssetRegistry,
  BadgeManager,
  Core,
  DisputeManager,
  Energon,
  ERC20,
  FeePool,
  LPPool,
  MarketCore,
  MediatorManager,
  NFT,
  Token,
  TokenPool,
} from '../../typechain';
import { isTest } from '../common/common';
import { PointService } from '../controllers/points/point.service';
import { NotifierService } from '../jobs/mailer/NotifierService';
import Meta, { MetaKeys } from '../models/meta';
import { ExchangeRateService } from '../services/exchange_rate.service';
import { MetadataService } from '../services/metadata/metadata.service';
import { RedisService } from '../services/redis/redis.service';
import { AssetRegistryHandler } from './assetregistry/asset_registry.handler';
import { BadgeManagerHandler } from './badge/badge_manager.handler';
import { CoreHandler } from './core/core.handler';
import { DisputeManagerHandler } from './disputemanager/dispute_manager.handler';
import { FeePoolHandler } from './feepool/fee_pool.handler';
import { LPPoolHandler } from './lppool/lp_pool.handler';
import { MarketCoreHandler } from './marketcore/market_core.handler';
import { MediatorManagerHandler } from './mediatormanager/mediator_manager.handler';
import { NFTHandler } from './nft/nft.handler';
import Processor from './processor';
import { TokenPoolHandler } from './tokenpool/token_pool.handler';
import { Watcher } from './watcher';

@Injectable()
export default class NetworkService {
  private logger = new Logger(NetworkService.name);
  private contracts: JointContracts = {};
  private provider: providers.JsonRpcProvider;
  private watchers: Watcher[] = [];

  constructor(
    public cfgSrv: ConfigService,
    public redisSrv: RedisService,
    private notifSrv: NotifierService,
    @Inject(forwardRef(() => MetadataService))
    private metadataSrv: MetadataService,
    private exrSrv: ExchangeRateService,
    public pointSrv: PointService,
  ) {
    if (isTest()) return;
    this.watch().catch((e) => {
      this.logger.error('Watcher error', e);
    });
  }

  /**
   * Watch event
   */
  private async watch() {
    const net = this.cfgSrv.get('app.network');
    await this.startGeneralWatcher(net);
    await this.startNFTWatcher(net);
    await this.restartWatcherSync();
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
   * Restart watcher sync when it's not active.
   */
  restartWatcherSync() {
    setInterval(async () => {
      for (const watcher of this.watchers) {
        if (Date.now() - watcher.getLastActiveTime() >= 120000) {
          this.logger.log(`Restarting watcher ${watcher.name}`);
          await watcher.sync();
        }
      }
    }, 10000);
  }

  /**
   * Load initial contracts params for a given network
   * @param network The network name
   */
  private async loadInitialContractParams(network: string) {
    const key = Meta.makeNetKey(network, MetaKeys.ContractsParams);
    const params = await Meta.get(key);
    if (params && params.value) return;
    await Meta.create(key, JSON.stringify(this.cfgSrv.get(`app.contractsParams`)));
    this.logger.log('Loaded initial contracts parameters');
  }

  /**
   * Connect and watch contracts.
   * @param network The name of the network
   */
  private async startGeneralWatcher(network: ChainNames) {
    const rpcUrl = this.cfgSrv.get(`app.contractsAddress.rpcUrl`) as string;
    if (!rpcUrl) throw new Error('startDefaultWatcher: rpcUrl is not defined');

    this.provider = rpcUrl.startsWith('ws')
      ? new providers.WebSocketProvider(rpcUrl)
      : new providers.JsonRpcProvider(rpcUrl);

    this.provider.on('error', (e) => {
      this.logger.error('Provider error', e);
    });

    // Initialize contracts
    const p2pTokenAddr = this.cfgSrv.get(`app.contractsAddress.p2pTokenAddr`);
    if (p2pTokenAddr) this.contracts.p2pToken = new Contract(p2pTokenAddr, p2pTokenABI, this.provider) as Token;

    const marketCoreAddr = this.cfgSrv.get(`app.contractsAddress.marketCoreAddr`);
    if (marketCoreAddr)
      this.contracts.marketCore = new Contract(marketCoreAddr, marketCoreABI, this.provider) as MarketCore;

    const coreAddr = this.cfgSrv.get(`app.contractsAddress.coreAddr`);
    if (coreAddr) this.contracts.core = new Contract(coreAddr, coreABI, this.provider) as Core;

    const mediatorMgr = this.cfgSrv.get(`app.contractsAddress.mediatorMgrAddr`);
    if (mediatorMgr)
      this.contracts.mediatorMgr = new Contract(mediatorMgr, mediatorManagerABI, this.provider) as MediatorManager;

    const disputeMgrAddr = this.cfgSrv.get(`app.contractsAddress.disputeMgrAddr`);
    if (disputeMgrAddr)
      this.contracts.disputeMgr = new Contract(disputeMgrAddr, disputeManagerABI, this.provider) as DisputeManager;

    const tokenPoolAddr = this.cfgSrv.get(`app.contractsAddress.tokenPoolAddr`);
    if (tokenPoolAddr) this.contracts.tokenPool = new Contract(tokenPoolAddr, tokenPoolABI, this.provider) as TokenPool;

    const lpPoolAddr = this.cfgSrv.get(`app.contractsAddress.lpPoolAddr`);
    if (lpPoolAddr) this.contracts.lpPool = new Contract(lpPoolAddr, lpPoolABI, this.provider) as LPPool;

    const feePoolAddr = this.cfgSrv.get(`app.contractsAddress.feePoolAddr`);
    if (feePoolAddr) this.contracts.feePool = new Contract(feePoolAddr, feePoolABI, this.provider) as FeePool;

    const badgeMgrAddr = this.cfgSrv.get(`app.contractsAddress.badgeMgrAddr`);
    if (badgeMgrAddr) this.contracts.badgeMgr = new Contract(badgeMgrAddr, badgeMgrABI, this.provider) as BadgeManager;

    const assetRegAddr = this.cfgSrv.get(`app.contractsAddress.assetRegAddr`);
    if (assetRegAddr)
      this.contracts.assetRegistry = new Contract(assetRegAddr, assetRegABI, this.provider) as AssetRegistry;

    const energonAddr = this.cfgSrv.get(`app.contractsAddress.energonAddr`);
    if (energonAddr) this.contracts.energon = new Contract(energonAddr, erc20TokenABI, this.provider) as Energon;

    // Load initial contract params
    await this.loadInitialContractParams(network);

    // Initialize handlers
    const handlers = [
      new MarketCoreHandler(this, this.notifSrv, this.provider, network, this.contracts),
      new MediatorManagerHandler(this, this.notifSrv, this.provider, network, this.contracts),
      new DisputeManagerHandler(this, this.notifSrv, this.provider, network, this.contracts),
      new CoreHandler(this, this.notifSrv, this.metadataSrv, this.exrSrv, this.provider, network, this.contracts),
      new BadgeManagerHandler(this, this.provider, network, this.contracts),
      new TokenPoolHandler(this.provider, network, this.contracts),
      new LPPoolHandler(this.provider, network, this.contracts),
      new FeePoolHandler(this.provider, network, this.contracts),
      new AssetRegistryHandler(this.provider, network, this.contracts),
    ];

    // Create event processor
    const processor = new Processor(network);
    await processor.add(...handlers);

    // Create event watcher
    if (!this.isWatcherDisabled()) {
      const watcher = new Watcher('', network, this.provider, processor, this.redisSrv);
      await watcher.add(...handlers);
      this.watchers.push(watcher);
    } else {
      this.logger.log('General Watcher is disabled');
    }
  }

  /**
   * Connect and watch NFT contracts.
   * @param network The name of the network
   */
  private async startNFTWatcher(network: ChainNames) {
    const rpcUrl = this.cfgSrv.get(`app.contractsAddress.rpcUrl`) as string;
    if (!rpcUrl) throw new Error('startNFTWatcher: rpcUrl is not defined');

    this.provider = this.provider
      ? this.provider
      : rpcUrl.startsWith('ws')
      ? new providers.WebSocketProvider(rpcUrl)
      : new providers.JsonRpcProvider(rpcUrl);

    // Initialize contracts
    const nftAddress = this.cfgSrv.get(`app.contractsAddress.nftAddr`);
    if (nftAddress) this.contracts.nft = new Contract(nftAddress, nftABI, this.provider) as NFT;

    // Load initial contract params
    await this.loadInitialContractParams(network);

    // Initialize handlers
    const handlers = [new NFTHandler(this, this.provider, network, this.contracts)];

    // Create event processor
    const processor = new Processor(network);
    await processor.add(...handlers);

    // Create event watcher
    if (!this.isWatcherDisabled('NFT_WATCHER')) {
      const watcher = new Watcher('NFT_WATCHER', network, this.provider, processor, this.redisSrv);
      await watcher.add(...handlers);
      this.watchers.push(watcher);
    } else {
      this.logger.log('NFT watcher is disabled');
    }
  }

  /**
   * Check if a watcher is disabled
   * @param name The watcher name
   * @returns
   */
  isWatcherDisabled(name?: string) {
    let disabled = ['true', '1'].includes(this.cfgSrv.get('app.disableWatcher'));
    if (!disabled && name) {
      const disabledWatchers = this.cfgSrv.get('app.disabledWatchers');
      disabled = disabledWatchers && disabledWatchers.split(',').includes(name);
    }
    return disabled;
  }
}
