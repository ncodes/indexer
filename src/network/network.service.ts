import { ChainNames } from '@jointlabs/chains-info';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, Provider } from 'ethers';
import * as erc20TokenABI from '../../abi/ERC20.json';
import { ERC20 } from '../../typechain';
import { isProd, isTest } from '../common/common';
import { PointService } from '../controllers/points/point.service';
import { NotificationService } from '../jobs/notifications/NotificationService';
import Meta, { MetaKeys } from '../models/meta';
import { ExchangeRateService } from '../services/exchange_rate.service';
import { MetadataService } from '../services/metadata/metadata.service';
import { RedisService } from '../services/redis/redis.service';
import { AssetRegistryHandler } from './assetregistry/asset_registry.handler';
import { BadgeManagerHandler } from './badge/badge_manager.handler';
import { ContractManager } from './contract_manager';
import { CoreHandler } from './core/core.handler';
import { DisputeManagerHandler } from './disputemanager/dispute_manager.handler';
import { MarketCoreHandler } from './marketcore/market_core.handler';
import { MediatorManagerHandler } from './mediatormanager/mediator_manager.handler';
import { MinerRegistryHandler } from './miner_registry/miner_registry.handler';
import { NFTHandler } from './nft/nft.handler';
import { getNetworkParams } from './params';
import Processor from './processor';
import { Watcher } from './watcher';
import { UniswapRouter } from './dexuser/uniswap_router.handler';

@Injectable()
export default class NetworkService {
  private logger = new Logger(NetworkService.name);
  private watchers: Watcher[] = [];
  private contractMgr = new ContractManager();

  constructor(
    public cfgSrv: ConfigService,
    public redisSrv: RedisService,
    private notifSrv: NotificationService,
    @Inject(forwardRef(() => MetadataService))
    private metadataSrv: MetadataService,
    private exrSrv: ExchangeRateService,
    public pointSrv: PointService,
  ) {
    if (isTest()) return;

    this.contractMgr.initialize(this.cfgSrv.get('app.infuraUASecret'));

    this.watch().catch((e) => {
      this.logger.error(e);
    });
  }

  /**
   * Watch event
   */
  private async watch() {
    if (isProd()) {
      await this.startWatcher('sepolia', 'sepolia');
      await this.startWatcher('arbitrum', 'arbitrum', 20);
      await this.startNFTWatcher('NFT_WATCHER', 'ethereum');
      await this.startDexWatcher('DEX_WATCHER_ETH', 'ethereum');
      await this.startDexWatcher('DEX_WATCHER_ETH_2', 'ethereum');
      await this.startDexWatcher('DEX_WATCHER_ETH_3', 'ethereum');
      await this.startDexWatcher('DEX_WATCHER_ETH_4', 'ethereum');
      await this.startDexWatcher('DEX_WATCHER_ETH_5', 'ethereum');
      await this.startDexWatcher('DEX_WATCHER_ETH_6', 'ethereum');
    } else {
      await this.startWatcher('localhost', 'localhost', 1);
      await this.startNFTWatcher('NFT_WATCHER', 'localhost');
      await this.startDexWatcher('DEX_WATCHER_ETH', 'ethereum');
    }
    this.restartWatcherSync();
  }

  /**
   * Get contracts linked to a given network
   * @param chain The name of the chain
   * @returns
   */
  getContracts(chain: ChainNames) {
    return this.contractMgr.contracts[chain];
  }

  /**
   * Get a network's provider
   * @returns
   */
  getProvider(chain: ChainNames): Provider {
    return this.contractMgr.providers[chain];
  }

  /**
   * Get an  ERC20 contract
   * @param chain The chain name
   * @param address The contract address
   */
  getERC20Contract(chain: ChainNames, address: string): ERC20 {
    return new Contract(address, erc20TokenABI, this.contractMgr.providers[chain]) as unknown as ERC20;
  }

  /**
   * Restart watcher sync when it's not active.
   */
  restartWatcherSync() {
    let restarting = false;

    setInterval(async () => {
      if (restarting) return;
      restarting = true;

      for (const watcher of this.watchers) {
        if (Date.now() - watcher.getLastActiveTime() < 120000) continue;
        this.logger.log(`Restarting watcher ${watcher.name}`);
        await watcher.sync();
      }

      restarting = false;
    }, 10000);
  }

  /**
   * Load initial contracts params for a given network
   * @param chain The name of the chain
   */
  private async loadInitialContractParams(chain: ChainNames) {
    const key = Meta.makeNetKey(chain, MetaKeys.ContractsParams);
    const params = await Meta.get(key);
    if (params && params.value) return;

    await Meta.create(key, JSON.stringify(getNetworkParams(chain)));
    this.logger.log('Loaded initial contracts parameters');
  }

  /**
   * Connect and watch contracts.
   * @param name The name of the watcher
   * @param network The name of the network
   * @param batchSize The number of blocks to process at once
   */
  private async startWatcher(name: string, network: ChainNames, batchSize = 1) {
    // Load initial contract params
    await this.loadInitialContractParams(network);

    // Initialize handlers
    const provider = this.contractMgr.providers[network];
    const handlers = [
      new MarketCoreHandler(this, this.notifSrv, provider, network, this.contractMgr.contracts[network]),
      new MediatorManagerHandler(this, this.notifSrv, provider, network, this.contractMgr.contracts[network]),
      new DisputeManagerHandler(this, this.notifSrv, provider, network, this.contractMgr.contracts[network]),
      new CoreHandler(
        this,
        this.notifSrv,
        this.metadataSrv,
        this.exrSrv,
        provider,
        network,
        this.contractMgr.contracts[network],
      ),
      new BadgeManagerHandler(this, provider, network, this.contractMgr.contracts[network]),
      new AssetRegistryHandler(provider, network, this.contractMgr.contracts[network]),
      new MinerRegistryHandler(provider, network, this.contractMgr.contracts[network]),
    ];

    // Create event processor
    const processor = new Processor(network);
    await processor.add(...handlers);

    // Create event watcher
    if (!this.isWatcherDisabled(name)) {
      const watcher = new Watcher(name, network, provider, processor, batchSize);
      await watcher.add(...handlers);
      this.watchers.push(watcher);
    } else {
      this.logger.log('General Watcher is disabled');
    }
  }

  private async startDexWatcher(name: string, network: ChainNames) {
    await this.loadInitialContractParams(network);

    const provider = this.contractMgr.providers[network];
    const handlers = [
      new UniswapRouter(this, provider, network, this.contractMgr.contracts[network].uniswapV2Router),
      new UniswapRouter(this, provider, network, this.contractMgr.contracts[network].uniswapV2Router2),
      new UniswapRouter(this, provider, network, this.contractMgr.contracts[network].uniswapV3Router),
      new UniswapRouter(this, provider, network, this.contractMgr.contracts[network].uniswapV3Router2),
      new UniswapRouter(this, provider, network, this.contractMgr.contracts[network].uniswapV3RouterUniversal),
    ];

    const processor = new Processor(network);
    await processor.add(...handlers);

    if (!this.isWatcherDisabled(name)) {
      const watcher = new Watcher(name, network, provider, processor, 1);
      watcher.setTopics(['Swap(address,uint256,uint256,uint256,uint256,address)']);
      await watcher.add(...handlers);
      this.watchers.push(watcher);
    } else {
      this.logger.log('DEX watcher is disabled');
    }
  }

  /**
   * Connect and watch NFT contracts.
   * @param name The name of the watcher
   * @param network The name of the network
   */
  private async startNFTWatcher(name: string, network: ChainNames) {
    // Load initial contract params
    await this.loadInitialContractParams(network);

    // Initialize handlers
    const provider = this.contractMgr.providers[network];
    const handlers = [new NFTHandler(this, provider, network, this.contractMgr.contracts[network])];

    // Create event processor
    const processor = new Processor(network);
    await processor.add(...handlers);

    // Create event watcher
    if (!this.isWatcherDisabled(name)) {
      const watcher = new Watcher(name, network, provider, processor, 1);
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
      disabled =
        disabledWatchers &&
        disabledWatchers
          .split(',')
          .map((v: string) => v.toLowerCase())
          .includes(name.toLowerCase());
    }

    return disabled;
  }
}
