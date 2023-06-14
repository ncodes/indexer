import { Injectable, Logger } from '@nestjs/common';
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
import { SupportedNetworks, toBN } from './common';
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

interface ContractInfo {
  [key: string]: JointContracts;
}

interface JsonRpcProviders {
  [key: string]: providers.JsonRpcProvider;
}

@Injectable()
export default class NetworkService {
  private logger = new Logger(NetworkService.name);
  private contracts: ContractInfo = {};
  private providers: JsonRpcProviders = {};

  constructor(public cfgSrv: ConfigService, private notifSrv: NotifierService) {
    if (isTestMode()) return;
    this.watch().catch(this.logger.error);
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
   * Get a network's provider
   * @param network The network name
   * @returns
   */
  getProvider(network: string): providers.JsonRpcProvider {
    return this.providers[network];
  }

  /**
   * Get an  ERC20 contract
   * @param network The network name
   * @param address The contract address
   */
  getERC20Contract(network: string, address: string): ERC20 {
    return new Contract(address, erc20TokenABI, this.providers[network]) as ERC20;
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
    ) as Token;
    this.contracts[network].marketCore = new Contract(
      this.cfgSrv.get(`app.networks.${network}.marketCoreAddr`),
      marketCoreABI,
      prov,
    ) as MarketCore;
    this.contracts[network].core = new Contract(
      this.cfgSrv.get(`app.networks.${network}.coreAddr`),
      coreABI,
      prov,
    ) as Core;
    this.contracts[network].mediatorMgr = new Contract(
      this.cfgSrv.get(`app.networks.${network}.mediatorMgrAddr`),
      mediatorManagerABI,
      prov,
    ) as MediatorManager;
    this.contracts[network].disputeMgr = new Contract(
      this.cfgSrv.get(`app.networks.${network}.disputeMgrAddr`),
      disputeManagerABI,
      prov,
    ) as DisputeManager;
    this.contracts[network].tokenPool = new Contract(
      this.cfgSrv.get(`app.networks.${network}.tokenPoolAddr`),
      tokenPoolABI,
      prov,
    ) as TokenPool;
    this.contracts[network].lpPool = new Contract(
      this.cfgSrv.get(`app.networks.${network}.lpPoolAddr`),
      lpPoolABI,
      prov,
    ) as LPPool;
    this.contracts[network].feePool = new Contract(
      this.cfgSrv.get(`app.networks.${network}.feePoolAddr`),
      feePoolABI,
      prov,
    ) as FeePool;
    this.contracts[network].badgeMgr = new Contract(
      this.cfgSrv.get(`app.networks.${network}.badgeMgrAddr`),
      badgeMgrABI,
      prov,
    ) as BadgeManager;
    this.contracts[network].assetRegistry = new Contract(
      this.cfgSrv.get(`app.networks.${network}.assetRegAddr`),
      assetRegABI,
      prov,
    ) as AssetRegistry;

    // Add handlers to watcher
    const watcher = new Watcher(network, prov);
    await watcher.add(
      new MarketCoreHandler(this, this.notifSrv, prov, network, this.contracts[network]),
      new MediatorManagerHandler(this, this.notifSrv, prov, network, this.contracts[network]),
      new DisputeManagerHandler(this, this.notifSrv, prov, network, this.contracts[network]),
      new CoreHandler(this, this.notifSrv, prov, network, this.contracts[network]),
      new BadgeManagerHandler(prov, network, this.contracts[network]),
      // new TokenPoolHandler(prov, network, this.contracts[network]),
      new LPPoolHandler(prov, network, this.contracts[network]),
      new FeePoolHandler(prov, network, this.contracts[network]),
      new AssetRegistryHandler(prov, network, this.contracts[network]),
    );
  }
}
