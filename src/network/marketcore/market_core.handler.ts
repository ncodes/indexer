import { ChainNames, findTokenInLocalhost, findTokenInSynthetic } from '@jointlabs/meta';
import { Logger } from '@nestjs/common';
import { Provider } from 'ethers';
import { Transaction } from 'objection';
import * as erc20ABI from '../../../abi/ERC20.json';
import * as erc721ABI from '../../../abi/ERC721.json';
import { isDev } from '../../common/common';
import { NotificationService } from '../../jobs/notifications/NotificationService';
import { NotificationID } from '../../jobs/notifications/common';
import Liquidity from '../../models/liquidity';
import Market from '../../models/market';
import LiquidityProvider from '../../models/market_provider';
import PermittedTrader from '../../models/permitted_trader';
import { ContractCallEvent, toNumber } from '../common';
import { Handler } from '../handler';
import NetworkService from '../network.service';
import Meta from '../../models/meta';

export class MarketCoreHandler extends Handler {
  public logger = new Logger(MarketCoreHandler.name);

  constructor(
    private netSrv: NetworkService,
    private notifSrv: NotificationService,
    private provider: Provider,
    public network: ChainNames,
    private contracts: JointContracts,
  ) {
    super(MarketCoreHandler.name, netSrv.cfgSrv, network, contracts.marketCore);
  }

  /**
   * Listen for events
   */
  listen() {
    this.on(
      'NewMarket',
      (
        id: string,
        owner: string,
        base: string,
        quote: string,
        baseType: number,
        quoteType: number,
        permPut: boolean,
        permSwap: boolean,
        commission: bigint,
        mediatorPoolId: bigint,
        event: ContractCallEvent,
        txn: Transaction,
      ) => {
        return this.onNewMarket(
          id,
          owner,
          base,
          quote,
          baseType,
          quoteType,
          permPut,
          permSwap,
          commission,
          mediatorPoolId,
          event,
          txn,
        );
      },
    );

    this.on('AllowedPut', async (id: string, address: string, event: ContractCallEvent, txn: Transaction) => {
      return this.onMarketPutAllowed(id, address, event, txn);
    });

    this.on('RevokedPut', async (id: string, address: string, event: ContractCallEvent, txn: Transaction) => {
      return this.onMarketPutRevoked(id, address, event, txn);
    });

    this.on('AllowedSwap', async (id: string, address: string, event: ContractCallEvent) => {
      return this.onAllowedSwap(id, address, event);
    });

    this.on('RevokedSwap', async (id: string, address: string, event: ContractCallEvent) => {
      return this.onRevokedSwap(id, address, event);
    });

    this.on('UpdatedCommission', async (id: string, value: bigint, event: ContractCallEvent) => {
      return this.onUpdatedCommission(id, value, event);
    });

    this.on('OfferOnlyEnabled', async (id: string, event: ContractCallEvent) => {
      return this.onOfferOnlyEnabled(id, event);
    });

    this.on(
      'TransferredOwnership',
      async (id: string, oldOwner: string, newOwner: string, event: ContractCallEvent) => {
        return this.onTransferredOwnership(id, oldOwner, newOwner, event);
      },
    );

    this.on('RenouncedMarket', async (id: string, renouncer: string, event: ContractCallEvent) => {
      return this.onRenouncedMarket(id, renouncer, event);
    });

    this.on('EnabledZeroOfferPrice', async (id: string, event: ContractCallEvent) => {
      return this.onEnabledZeroOfferPrice(id, event);
    });

    this.on(
      'UpdatedMarketBadges',
      async (
        id: string,
        put: [string, string][],
        swap: [string, string][],
        event: ContractCallEvent,
        txn: Transaction,
      ) => {
        return this.onUpdatedMarketBadges(id, put, swap, event, txn);
      },
    );

    this.on(
      'UpdatedDisputeDelayDuration',
      async (id: string, disputeDelayDur: bigint, event: ContractCallEvent, txn: Transaction) => {
        return this.onUpdatedDisputeDelayDuration(id, disputeDelayDur, event, txn);
      },
    );

    this.on(
      'UpdatedMarketManager',
      async (id: string, managerAddr: string, event: ContractCallEvent, txn?: Transaction) => {
        return this.onUpdatedMarketManager(id, managerAddr, event, txn);
      },
    );

    this.on('UpdatedNativeAssetAddr', async (addr: string, event: ContractCallEvent, txn?: Transaction) => {
      return this.onParameterUpdate('nativeAssetAddr', addr, event, txn);
    });
  }

  /**
   * Updated a market's badges
   * @param id The market ID
   * @param put The PUT badges
   * @param swap The SWAP badges
   * @param _event The event object
   * @param txn The db transaction object
   */
  async onUpdatedMarketBadges(
    id: string,
    put: [string, string][],
    swap: [string, string][],
    _event: ContractCallEvent,
    txn?: Transaction,
  ) {
    await Market.updateByNetworkAddress(
      this.network,
      id,
      {
        requiredPutBadges: put.map((b) => b.join('/').replace(/\/$/, '')),
        requiredSwapBadges: swap.map((b) => b.join('/').replace(/\/$/, '')),
      },
      txn,
    );
  }

  /**
   * Enabled zero-priced liquidity for a market
   * @param id The market ID
   * @param _event The event object
   * @param txn The db transaction object
   */
  async onEnabledZeroOfferPrice(id: string, _event: ContractCallEvent, txn?: Transaction) {
    await Market.updateByNetworkAddress(this.network, id, { enabledZeroOfferPrice: true }, txn);
  }

  /**
   * Transferred ownership to another address
   * @param id The market ID
   * @param oldOwner The old owner address
   * @param newOwner The new owner address
   * @param _event The event object
   * @param txn The db transaction object
   */
  async onTransferredOwnership(
    id: string,
    oldOwner: string,
    newOwner: string,
    _event: ContractCallEvent,
    txn?: Transaction,
  ) {
    await Market.updateByNetworkAddress(this.network, id, { creator: newOwner }, txn);
  }

  /**
   * Renounced ownership of a market
   * @param id The market ID
   * @param _renouncer The renouncer's address
   * @param _event The event object
   * @param txn The db transaction object
   */
  async onRenouncedMarket(id: string, _renouncer: string, _event: ContractCallEvent, txn?: Transaction) {
    await Market.updateByNetworkAddress(this.network, id, { renounced: true }, txn);
  }

  /**
   * Offer was enabled
   * @param id The market ID
   * @param event The event object
   * @param txn The db transaction object
   */
  async onOfferOnlyEnabled(id: string, event: ContractCallEvent, txn?: Transaction) {
    await Market.updateByNetworkAddress(this.network, id, { offerOnly: true }, txn);
  }

  /**
   * New market creation
   * @param id The market ID
   * @param owner The address of the market creator
   * @param baseAsset The base asset of the market
   * @param quoteAsset The quote asset of the market
   * @param baseType Indicates the type of the base asset
   * @param quoteType Indicates the type of the quote asset
   * @param permPut Indicates if the market enabled PUT permission
   * @param permSwap Indicates if the market enabled SWAP permission
   * @param commission The market creator commission base point
   * @param mediatorPoolId The mediator pool ID
   * @param event The event object
   * @param txn The db transaction object
   */
  async onNewMarket(
    id: string,
    owner: string,
    baseAsset: string,
    quoteAsset: string,
    baseType: number,
    quoteType: number,
    permPut: boolean,
    permSwap: boolean,
    commission: bigint,
    mediatorPoolId: bigint,
    event: ContractCallEvent,
    txn?: Transaction,
  ) {
    this.logger.log(`NewMarket: processing...`);

    let baseSymbol = '',
      quoteSymbol = '',
      baseDecimals: number,
      quoteDecimals: number;

    if (!isDev(true)) {
      if (Market.isERC20(baseType)) {
        const baseToken = this.newContract(baseAsset, erc20ABI, this.provider);
        baseSymbol = (await baseToken.symbol()).toUpperCase();
        baseDecimals = await baseToken.decimals();
      }

      if (Market.isERC20(quoteType)) {
        const quoteToken = this.newContract(quoteAsset, erc20ABI, this.provider);
        quoteSymbol = (await quoteToken.symbol()).toUpperCase();
        quoteDecimals = await quoteToken.decimals();
      }

      if (Market.isERC721(baseType)) {
        const baseToken = this.newContract(baseAsset, erc721ABI, this.provider);
        baseSymbol = (await baseToken.symbol()).toUpperCase();
        baseDecimals = 0;
      }

      if (Market.isERC721(quoteType)) {
        const quoteToken = this.newContract(quoteAsset, erc721ABI, this.provider);
        quoteSymbol = (await quoteToken.symbol()).toUpperCase();
        quoteDecimals = 0;
      }

      if (Market.isSynth(baseType)) {
        const token = findTokenInSynthetic(baseAsset);
        baseSymbol = token ? token.symbol.toUpperCase() : 'UNKNW';
        baseDecimals = token ? token.decimals : 18;
      }

      if (Market.isSynth(quoteType)) {
        const token = findTokenInSynthetic(quoteAsset);
        quoteSymbol = token ? token.symbol.toUpperCase() : 'UNKNW';
        quoteDecimals = token ? token.decimals : 18;
      }
    } else {
      const base = findTokenInLocalhost(baseAsset);
      baseSymbol = base?.symbol;
      baseDecimals = base?.decimals;

      if (!base && Market.isERC20(baseType)) {
        try {
          const baseToken = this.newContract(baseAsset, erc20ABI, this.provider);
          baseSymbol = (await baseToken.symbol()).toUpperCase();
          baseDecimals = await baseToken.decimals();
        } catch (error) {
          baseSymbol = 'UNKNW';
          baseDecimals = 18;
        }
      }

      const quote = findTokenInLocalhost(quoteAsset);
      quoteSymbol = quote?.symbol;
      quoteDecimals = quote?.decimals;

      if (!quote && Market.isERC20(quoteType)) {
        try {
          const quoteToken = this.newContract(quoteAsset, erc20ABI, this.provider);
          quoteSymbol = (await quoteToken.symbol()).toUpperCase();
          quoteDecimals = await quoteToken.decimals();
        } catch (error) {
          quoteSymbol = 'UNKNW';
          quoteDecimals = 18;
        }
      }
    }

    await Market.create(
      {
        address: id,
        creator: owner,
        base: baseSymbol,
        baseAddress: baseAsset,
        baseType: baseType,
        baseDecimals: baseDecimals,
        quote: quoteSymbol,
        quoteAddress: quoteAsset,
        quoteType: quoteType,
        quoteDecimals: quoteDecimals,
        instant: Market.isInstant(baseType, quoteType),
        pair: `${baseSymbol}${quoteSymbol}`,
        network: this.network,
        commission: toNumber(commission),
        txHash: event.transactionHash,
        mediatorPoolId: toNumber(mediatorPoolId),
        permPut: permPut,
        permSwap: permSwap,
      },
      txn,
    );

    await this.netSrv.pointSrv.grantPoint('market:created', this.network, owner, event, txn);
  }

  /**
   * New address allowed to provide liquidity to a market
   * @param marketAddress The market ID
   * @param address The address approved
   * @param event The event object
   * @param txn The db transaction object
   */
  async onMarketPutAllowed(marketAddress: string, address: string, event: ContractCallEvent, txn?: Transaction) {
    await LiquidityProvider.create(
      {
        network: this.network,
        marketAddress,
        address,
      },
      txn,
    );

    // Enable any existing liquidity created by the user
    await Liquidity.update(this.network, marketAddress, address, undefined, { swapDisabled: false }, txn);

    // Notify approved user
    const market = await Market.getMarket(this.network, marketAddress, [], undefined, true, txn);
    void void this.notifSrv.notify(NotificationID.PutApproved, this.network, address, {
      market,
    });
  }

  /**
   * An address was revoked from providing liquidity to a market
   * @param marketAddress The market ID
   * @param address The address revoked
   * @param event The event object
   * @param txn The db transaction object
   */
  async onMarketPutRevoked(marketAddress: string, address: string, event: ContractCallEvent, txn?: Transaction) {
    await LiquidityProvider.remove(this.network, marketAddress, address, txn);

    // Disable all liquidity created by the revoked user
    await Liquidity.update(this.network, marketAddress, address, undefined, { swapDisabled: true }, txn);

    // Notify revoked user
    const market = await Market.getMarket(this.network, marketAddress, [], undefined, true, txn);
    void this.notifSrv.notify(NotificationID.PutRevoked, this.network, address, { market });
  }

  /**
   * An address was approved for swapping
   * @param marketAddress The market ID
   * @param address The address of that was approved
   * @param event The event object
   * @param txn The db transaction object
   */
  async onAllowedSwap(marketAddress: string, address: string, event: ContractCallEvent, txn?: Transaction) {
    await PermittedTrader.create({ network: this.network, marketAddress, address }, txn);

    // Notify approved user
    const market = await Market.getMarket(this.network, marketAddress, [], undefined, true, txn);
    void this.notifSrv.notify(NotificationID.SwapApproved, this.network, address, { market });
  }

  /**
   * An address was revoked from swapping.
   * @param marketAddress The market ID
   * @param address The address that was revoked
   * @param event The event object
   * @param txn The db transaction object
   */
  async onRevokedSwap(marketAddress: string, address: string, event: ContractCallEvent, txn?: Transaction) {
    await PermittedTrader.remove(this.network, marketAddress, address, txn);

    // Notify revoked user
    const market = await Market.getMarket(this.network, marketAddress, [], undefined, true, txn);
    void this.notifSrv.notify(NotificationID.SwapRevoked, this.network, address, { market });
  }

  /**
   * A market's commission has been set
   * @param id The market ID
   * @param value The updated value
   * @param event The event object
   * @param txn The db transaction object
   */
  async onUpdatedCommission(id: string, value: bigint, event: ContractCallEvent, txn?: Transaction) {
    await Market.updateByNetworkAddress(this.network, id, { commission: toNumber(value) }, txn);
  }

  /**
   * Updated dispute durations
   * @param id The market ID
   * @param disputeDelayDur Number of seconds before dispute can be started
   * @param _event The event object
   * @param txn The db transaction object
   */
  async onUpdatedDisputeDelayDuration(
    id: string,
    disputeDelayDur: bigint,
    _event: ContractCallEvent,
    txn?: Transaction,
  ) {
    await Market.updateByNetworkAddress(this.network, id, { disputeDelayDur: toNumber(disputeDelayDur) }, txn);
  }

  /**
   * Updated market manager
   * @param id The market ID
   * @param managerAddr The new manager address
   * @param event The event object
   * @param txn The db transaction object
   */
  async onUpdatedMarketManager(id: string, managerAddr: string, event: ContractCallEvent, txn?: Transaction) {
    await Market.updateByNetworkAddress(this.network, id, { manager: managerAddr }, txn);
  }

  /**
   * Updated a parameter
   * @param param The parameter name
   * @param value The updated value
   * @param _event The event object
   * @param txn The transaction object
   */
  async onParameterUpdate(param: keyof ContractsParams, value: string, _event: ContractCallEvent, txn?: Transaction) {
    await Meta.updateContractsParams(this.network, txn, (params) => (params[param] = value));
  }
}
