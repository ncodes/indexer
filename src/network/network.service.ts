import { ChainNames } from '@jointlabs/chains-info';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, Provider } from 'ethers';
import * as erc20TokenABI from '../../abi/ERC20.json';
import { ERC20 } from '../../typechain';
import { isTest } from '../common/common';
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
import { NFTHandler } from './nft/nft.handler';
import { getNetworkParams } from './params';
import Processor from './processor';
import { Watcher } from './watcher';

@Injectable()
export default class NetworkService {
  private logger = new Logger(NetworkService.name);
  private watchers: Watcher[] = [];
  private net: ChainNames;
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
    this.net = this.cfgSrv.get('app.network');
    if (!this.net) throw new Error('Network is not defined');
    await this.startGeneralWatcher(this.net);
    await this.startNFTWatcher(this.net);
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
   * @para chain The chain name
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
   * @param network The network name
   */
  private async loadInitialContractParams() {
    const key = Meta.makeNetKey(this.net, MetaKeys.ContractsParams);
    const params = await Meta.get(key);
    if (params && params.value) return;

    await Meta.create(key, JSON.stringify(getNetworkParams(this.net)));
    this.logger.log('Loaded initial contracts parameters');
  }

  /**
   * Connect and watch contracts.
   * @param network The name of the network
   */
  private async startGeneralWatcher(network: ChainNames) {
    // Load initial contract params
    await this.loadInitialContractParams();

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
    ];

    // Create event processor
    const processor = new Processor(network);
    await processor.add(...handlers);

    // Create event watcher
    if (!this.isWatcherDisabled()) {
      const watcher = new Watcher('', network, provider, processor, this.redisSrv);
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
    // Load initial contract params
    await this.loadInitialContractParams();

    // Initialize handlers
    const provider = this.contractMgr.providers[network];
    const handlers = [new NFTHandler(this, provider, network, this.contractMgr.contracts[network])];

    // Create event processor
    const processor = new Processor(network);
    await processor.add(...handlers);

    // Create event watcher
    if (!this.isWatcherDisabled('NFT_WATCHER')) {
      const watcher = new Watcher('NFT_WATCHER', network, provider, processor, this.redisSrv);
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
