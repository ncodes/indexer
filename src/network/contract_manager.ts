import { Abi, AbiTypes, ChainNames, getChainByName, getChainNames } from '@jointlabs/meta';
import { Logger } from '@nestjs/common';
import { Contract, ContractRunner, FetchRequest, Interface, InterfaceAbi, JsonRpcProvider, Provider } from 'ethers';

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

  getContract<C>(target: string, abi: Interface | InterfaceAbi, runner?: ContractRunner | null | undefined): C {
    return new Contract(target, abi, runner) as unknown as C;
  }

  /**
   * Initialize a chain's contract and provider
   * @param chain The chain name
   * @param infuraUASecret The infura user agent secret
   * @returns
   */
  private initChain(chain: ChainNames, infuraUASecret: string) {
    if (this.contracts[chain]) return;
    const targetChain = getChainByName(chain);

    const rpcUrl = targetChain.rpcUrl;
    if (!rpcUrl) {
      this.logger.debug('initChain: rpcUrl is not defined...skipping chain', JSON.stringify({ chain }));
      return;
    }

    const fetchRequest = new FetchRequest(rpcUrl);
    fetchRequest.setHeader('User-Agent', infuraUASecret);
    const provider = new JsonRpcProvider(fetchRequest);
    this.providers[chain] = provider;
    this.contracts[chain] = {};

    const p2pTokenAddr = targetChain.contracts['token'].address;
    if (p2pTokenAddr)
      this.contracts[chain].p2pToken = this.getContract<AbiTypes.Token>(p2pTokenAddr, Abi.NativeToken, provider);

    const marketCoreAddr = targetChain.contracts['marketCore'].address;
    if (marketCoreAddr)
      this.contracts[chain].marketCore = this.getContract<AbiTypes.MarketCore>(
        marketCoreAddr,
        Abi.MarketCore,
        provider,
      );

    const coreAddr = targetChain.contracts['core'].address;
    if (coreAddr) this.contracts[chain].core = this.getContract<AbiTypes.Core>(coreAddr, Abi.Core, provider);

    const mediatorMgr = targetChain.contracts['mediatorManager'].address;
    if (mediatorMgr)
      this.contracts[chain].mediatorMgr = this.getContract<AbiTypes.MediatorManager>(
        mediatorMgr,
        Abi.MediatorManager,
        provider,
      );

    const disputeMgrAddr = targetChain.contracts['disputeManager'].address;
    if (disputeMgrAddr)
      this.contracts[chain].disputeMgr = this.getContract<AbiTypes.DisputeManager>(
        disputeMgrAddr,
        Abi.DisputeManager,
        provider,
      );

    const badgeMgrAddr = targetChain.contracts['badgeManager'].address;
    if (badgeMgrAddr)
      this.contracts[chain].badgeMgr = this.getContract<AbiTypes.BadgeManager>(
        badgeMgrAddr,
        Abi.BadgeManager,
        provider,
      );

    const assetRegAddr = targetChain.contracts['assetRegistry'].address;
    if (assetRegAddr)
      this.contracts[chain].assetRegistry = this.getContract<AbiTypes.AssetRegistry>(
        assetRegAddr,
        Abi.AssetRegistry,
        provider,
      );

    const minerRegAddr = targetChain.contracts['minerRegistry'].address;
    if (minerRegAddr)
      this.contracts[chain].minerRegistry = this.getContract<AbiTypes.MinerRegistry>(
        minerRegAddr,
        Abi.MinerRegistry,
        provider,
      );

    const providerRegAddr = targetChain.contracts['providerRegistry'].address;
    if (providerRegAddr)
      this.contracts[chain].providerRegistry = this.getContract<AbiTypes.ProviderRegistry>(
        providerRegAddr,
        Abi.ProviderRegistry,
        provider,
      );

    const payRouterAddr = targetChain.contracts['payRouter'].address;
    if (payRouterAddr)
      this.contracts[chain].payRouter = this.getContract<AbiTypes.PayRouter>(payRouterAddr, Abi.PayRouter, provider);

    const marketMgrAddr = targetChain.contracts['marketManager'].address;
    if (marketMgrAddr)
      this.contracts[chain].marketManager = this.getContract<AbiTypes.MarketManager>(
        marketMgrAddr,
        Abi.MarketManager,
        provider,
      );

    const energonAddr = targetChain.contracts['energon'].address;
    if (energonAddr)
      this.contracts[chain].energon = this.getContract<AbiTypes.Energon>(energonAddr, Abi.Energon, provider);

    const nftAddress = targetChain.contracts['nft'].address;
    if (nftAddress) this.contracts[chain].nft = this.getContract<AbiTypes.NFT>(nftAddress, Abi.NFT, provider);

    const uniswapV2Router = targetChain.contracts['uniswapV2Router']?.address;
    if (uniswapV2Router)
      this.contracts[chain].uniswapV2Router = this.getContract<AbiTypes.NFT>(
        uniswapV2Router,
        Abi.UniswapV2Router,
        provider,
      ) as unknown as AbiTypes.UniswapV2Router;

    const uniswapV2Router2 = targetChain.contracts['uniswapV2Router2']?.address;
    if (uniswapV2Router2)
      this.contracts[chain].uniswapV2Router2 = new Contract(
        uniswapV2Router2,
        Abi.UniswapV2Router2,
        provider,
      ) as unknown as AbiTypes.UniswapV2Router2;

    const uniswapV3Router = targetChain.contracts['uniswapV3Router']?.address;
    if (uniswapV3Router)
      this.contracts[chain].uniswapV3Router = new Contract(
        uniswapV3Router,
        Abi.UniswapV3Router,
        provider,
      ) as unknown as AbiTypes.UniswapV3Router;

    const uniswapV3Router2 = targetChain.contracts['uniswapV3Router02']?.address;
    if (uniswapV3Router2)
      this.contracts[chain].uniswapV3Router2 = new Contract(
        uniswapV3Router2,
        Abi.UniswapV3Router2,
        provider,
      ) as unknown as AbiTypes.UniswapV3Router2;

    const uniswapV3RouterUniversal = targetChain.contracts['uniswapV3UniversalRouter']?.address;
    if (uniswapV3RouterUniversal)
      this.contracts[chain].uniswapV3RouterUniversal = new Contract(
        uniswapV3RouterUniversal,
        Abi.UniswapV3RouterUniversal,
        provider,
      ) as unknown as AbiTypes.UniswapV3RouterUniversal;
  }
}
