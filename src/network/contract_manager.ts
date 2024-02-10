import { ChainNames, getChainByName, getChainNames } from '@jointlabs/chains-info';
import { Logger } from '@nestjs/common';
import { Contract, FetchRequest, JsonRpcProvider, Provider } from 'ethers';
import * as assetRegABI from '../../abi/AssetRegistry.json';
import * as badgeMgrABI from '../../abi/BadgeManager.json';
import * as coreABI from '../../abi/Core.json';
import * as disputeManagerABI from '../../abi/DisputeManager.json';
import * as erc20TokenABI from '../../abi/ERC20.json';
import * as marketCoreABI from '../../abi/MarketCore.json';
import * as mediatorManagerABI from '../../abi/MediatorManager.json';
import * as nftABI from '../../abi/NFT.json';
import * as p2pTokenABI from '../../abi/Token.json';
import {
  AssetRegistry,
  BadgeManager,
  Core,
  DisputeManager,
  Energon,
  MarketCore,
  MediatorManager,
  NFT,
  Token,
} from '../../typechain';

export class ContractManager {
  logger = new Logger(ContractManager.name);
  contracts: Partial<Record<ChainNames, JointContracts>> = {};
  providers: Partial<Record<ChainNames, Provider>> = {};

  /**
   * Initialize the contract manager
   * @param infuraUASecret The infura user agent secret
   */
  initialize(infuraUASecret: string) {
    const chains = getChainNames();
    for (const chain of chains) {
      this.initChain(chain as ChainNames, infuraUASecret);
    }
  }

  /**
   * Initialize a chain's contract and provider
   * @param chain The chain name
   * @param infuraUASecret The infura user agent secret
   * @returns
   */
  private initChain(chain: ChainNames, infuraUASecret: string) {
    if (this.contracts[chain]) return;

    const rpcUrl = getChainByName(chain).rpcUrl;
    if (!rpcUrl) {
      this.logger.debug('initChain: rpcUrl is not defined...skipping chain', { chain });
      return;
    }

    const fetchRequest = new FetchRequest(rpcUrl);
    fetchRequest.setHeader('User-Agent', infuraUASecret);
    const provider = new JsonRpcProvider(fetchRequest);
    this.providers[chain] = provider;
    this.contracts[chain] = {};

    const p2pTokenAddr = getChainByName(chain).contracts['token'].address;
    if (p2pTokenAddr) {
      this.contracts[chain].p2pToken = new Contract(p2pTokenAddr, p2pTokenABI, provider) as unknown as Token;
    }

    const marketCoreAddr = getChainByName(chain).contracts['marketCore'].address;
    if (marketCoreAddr)
      this.contracts[chain].marketCore = new Contract(marketCoreAddr, marketCoreABI, provider) as unknown as MarketCore;

    const coreAddr = getChainByName(chain).contracts['core'].address;
    if (coreAddr) this.contracts[chain].core = new Contract(coreAddr, coreABI, provider) as unknown as Core;

    const mediatorMgr = getChainByName(chain).contracts['mediatorManager'].address;
    if (mediatorMgr)
      this.contracts[chain].mediatorMgr = new Contract(
        mediatorMgr,
        mediatorManagerABI,
        provider,
      ) as unknown as MediatorManager;

    const disputeMgrAddr = getChainByName(chain).contracts['disputeManager'].address;
    if (disputeMgrAddr)
      this.contracts[chain].disputeMgr = new Contract(
        disputeMgrAddr,
        disputeManagerABI,
        provider,
      ) as unknown as DisputeManager;

    const badgeMgrAddr = getChainByName(chain).contracts['badgeManager'].address;
    if (badgeMgrAddr)
      this.contracts[chain].badgeMgr = new Contract(badgeMgrAddr, badgeMgrABI, provider) as unknown as BadgeManager;

    const assetRegAddr = getChainByName(chain).contracts['assetRegistry'].address;
    if (assetRegAddr)
      this.contracts[chain].assetRegistry = new Contract(
        assetRegAddr,
        assetRegABI,
        provider,
      ) as unknown as AssetRegistry;

    const energonAddr = getChainByName(chain).contracts['energon'].address;
    if (energonAddr)
      this.contracts[chain].energon = new Contract(energonAddr, erc20TokenABI, provider) as unknown as Energon;

    const nftAddress = getChainByName(chain).contracts['nft'].address;
    if (nftAddress) this.contracts[chain].nft = new Contract(nftAddress, nftABI, provider) as unknown as NFT;
  }
}
