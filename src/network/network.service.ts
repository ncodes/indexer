import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, providers } from 'ethers';
import * as coreABI from '../../abi/core.json';
import * as disputeManagerABI from '../../abi/disputemanager.json';
import * as feeSharerABI from '../../abi/feesharer.json';
import * as lpStakerABI from '../../abi/lpstaker.json';
import * as marketCoreABI from '../../abi/marketcore.json';
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

@Injectable()
export default class NetworkService {
  private contracts: {
    [key: string]: KnownContracts;
  } = {};

  constructor(private cfgSrv: ConfigService) {
    this.watch();
  }

  /**
   * Watch events on different on different networks
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
   * Connect and watch contracts on the Ethereum mainnet.
   * @param network The name of the network
   */
  async watchNetwork(network: string) {
    const provider = new providers.JsonRpcProvider(
      this.cfgSrv.get(`app.networks.${network}.rpcUrl`),
    );
    await provider.resetEventsBlock(1);

    this.contracts[network] = {};

    // Initialize contracts
    this.contracts[network].p2pToken = new Contract(
      this.cfgSrv.get(`app.networks.${network}.p2pTokenAddr`),
      p2pTokenABI,
      provider,
    );
    this.contracts[network].marketCore = new Contract(
      this.cfgSrv.get(`app.networks.${network}.marketCoreAddr`),
      marketCoreABI,
      provider,
    );
    this.contracts[network].core = new Contract(
      this.cfgSrv.get(`app.networks.${network}.coreAddr`),
      coreABI,
      provider,
    );
    this.contracts[network].mediatorMgr = new Contract(
      this.cfgSrv.get(`app.networks.${network}.mediatorMgrAddr`),
      marketManagerABI,
      provider,
    );
    this.contracts[network].disputeMgr = new Contract(
      this.cfgSrv.get(`app.networks.${network}.disputeMgrAddr`),
      disputeManagerABI,
      provider,
    );
    this.contracts[network].p2pStaker = new Contract(
      this.cfgSrv.get(`app.networks.${network}.p2pStakerAddr`),
      p2pStakerABI,
      provider,
    );
    this.contracts[network].lpStaker = new Contract(
      this.cfgSrv.get(`app.networks.${network}.lpStakerAddr`),
      lpStakerABI,
      provider,
    );
    this.contracts[network].feeSharer = new Contract(
      this.cfgSrv.get(`app.networks.${network}.feeSharerAddr`),
      feeSharerABI,
      provider,
    );

    // Listen for events
    new MarketCoreHandler(provider, network, this.contracts[network]).listen();
    new CoreHandler(provider, network, this.contracts[network]).listen();
    new MediatorManagerHandler(
      provider,
      network,
      this.contracts[network],
    ).listen();
    new DisputeManagerHandler(
      provider,
      network,
      this.contracts[network],
    ).listen();
    new P2PStakerHandler(provider, network, this.contracts[network]).listen();
    new LPStakerHandler(provider, network, this.contracts[network]).listen();
    new FeeSharerHandler(provider, network, this.contracts[network]).listen();
  }
}
