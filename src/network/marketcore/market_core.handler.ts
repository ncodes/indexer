import { Logger } from '@nestjs/common';
import { BigNumber, Event, providers } from 'ethers';
import { Transaction } from 'objection';
import * as erc20ABI from '../../../abi/ERC20.json';
import * as erc721ABI from '../../../abi/ERC721.json';
import Market from '../../models/market';
import { Handler } from '../handler';
import LiquidityProvider from '../../models/market_provider';
import InvitedMediator from '../../models/invited_mediators';
import PermittedTrader from '../../models/permitted_trader';
import { NotifierService, NotificationID } from '../../jobs/mailer/NotifierService';
import NetworkService from '../network.service';
import MarketBadge, { BadgeScope } from '../../models/market_badge';
import { findInSynthetic } from '../../common/token_list';
import * as console from 'console';

export class MarketCoreHandler extends Handler {
  public logger = new Logger(MarketCoreHandler.name);

  constructor(
    private netSrv: NetworkService,
    private notifSrv: NotifierService,
    private provider: providers.JsonRpcProvider,
    public network: string,
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
        commission: BigNumber,
        numMediators: BigNumber,
        event: Event,
        txn: Transaction,
      ) => {
        return this.onNewMarket(id, owner, base, quote, baseType, quoteType, commission, numMediators, event, txn);
      },
    );

    this.on('AllowedPut', async (id: string, address: string, event: Event, txn: Transaction) => {
      return this.onMarketPutAllowed(id, address, event, txn);
    });

    this.on('RevokedPut', async (id: string, address: string, event: Event, txn: Transaction) => {
      return this.onMarketPutRevoked(id, address, event, txn);
    });

    this.on('InvitedMediator', async (id: string, address: string, event: Event) => {
      return this.onInvitedMediator(id, address, event);
    });

    this.on('UnInvitedMediator', async (id: string, address: string, event: Event) => {
      return this.onUnInvitedMediator(id, address, event);
    });

    this.on('AcceptedMediatorInvite', async (id: string, address: string, event: Event) => {
      return this.onAcceptedMediatorInvite(id, address, event);
    });

    this.on('RevokedMediator', async (id: string, address: string, event: Event) => {
      return this.onRevokedMediator(id, address, event);
    });

    this.on('AllowedSwap', async (id: string, address: string, event: Event) => {
      return this.onAllowedSwap(id, address, event);
    });

    this.on('RevokedSwap', async (id: string, address: string, event: Event) => {
      return this.onRevokedSwap(id, address, event);
    });

    this.on('UpdatedCommission', async (id: string, value: BigNumber, event: Event) => {
      return this.onUpdatedCommission(id, value, event);
    });

    this.on('OfferOnlyEnabled', async (id: string, event: Event) => {
      return this.onOfferOnlyEnabled(id, event);
    });

    this.on('TransferredOwnership', async (id: string, oldOwner: string, newOwner: string, event: Event) => {
      return this.onTransferredOwnership(id, oldOwner, newOwner, event);
    });

    this.on('ZeroPriceEnabled', async (id: string, event: Event) => {
      return this.onZeroPriceEnabled(id, event);
    });

    this.on(
      'UpdatedMarketBadges',
      async (
        id: string,
        put: [string, string][],
        swap: [string, string][],
        mediate: [string, string][],
        event: Event,
        txn: Transaction,
      ) => {
        return this.onUpdatedMarketBadges(id, put, swap, mediate, event, txn);
      },
    );

    this.on(
      'UpdatedDisputeDurations',
      async (
        id: string,
        disputeDelayTime: BigNumber,
        evidenceDur: BigNumber,
        predictDur: BigNumber,
        appealDur: BigNumber,
        event: Event,
        txn: Transaction,
      ) => {
        return this.onUpdatedDisputeDurations(id, disputeDelayTime, evidenceDur, predictDur, appealDur, event, txn);
      },
    );

    this.on('UpdatedMarketManager', async (id: string, managerAddr: string, event: Event, txn?: Transaction) => {
      return this.onUpdatedMarketManager(id, managerAddr, event, txn);
    });

    this.on('UpdatedDisputeCost', async (id: string, newCost: BigNumber, event: Event, txn?: Transaction) => {
      return this.onUpdatedDisputeCost(id, newCost, event, txn);
    });
  }

  /**
   * Updated a market's badges
   * @param id The market ID
   * @param put The PUT badges
   * @param swap The SWAP badges
   * @param mediate The MEDIATE badges
   * @param event The event object
   * @param txn The db transaction object
   */
  async onUpdatedMarketBadges(
    id: string,
    put: [string, string][],
    swap: [string, string][],
    mediate: [string, string][],
    event: Event,
    txn?: Transaction,
  ) {
    await MarketBadge.deleteByMarketAddress(this.network, id, txn);
    for (const badge of put) {
      if (badge[0] == '' && badge[1] == '') continue;
      await MarketBadge.create(
        {
          network: this.network,
          marketAddress: id,
          badge: badge[0],
          path: badge[1],
          scope: BadgeScope.PUT,
        },
        txn,
      );
    }
    for (const badge of swap) {
      if (badge[0] == '' && badge[1] == '') continue;
      await MarketBadge.create(
        {
          network: this.network,
          marketAddress: id,
          badge: badge[0],
          path: badge[1],
          scope: BadgeScope.SWAP,
        },
        txn,
      );
    }
    for (const badge of mediate) {
      if (badge[0] == '' && badge[1] == '') continue;
      await MarketBadge.create(
        {
          network: this.network,
          marketAddress: id,
          badge: badge[0],
          path: badge[1],
          scope: BadgeScope.MEDIATE,
        },
        txn,
      );
    }
  }

  /**
   * Enabled zero-priced liquidity for a market
   * @param id The market ID
   * @param event The event object
   * @param txn The db transaction object
   */
  async onZeroPriceEnabled(id: string, event: Event, txn?: Transaction) {
    await Market.updateByNetworkAddress(this.network, id, { allowZeroPrice: true }, txn);
  }

  /**
   * Transferred ownership to another address
   * @param id The market ID
   * @param oldOwner The old owner address
   * @param newOwner The new owner address
   * @param event The event object
   * @param txn The db transaction object
   */
  async onTransferredOwnership(id: string, oldOwner: string, newOwner: string, event: Event, txn?: Transaction) {
    await Market.updateByNetworkAddress(this.network, id, { creator: newOwner }, txn);
  }

  /**
   * Offer was enabled
   * @param id The market ID
   * @param event The event object
   * @param txn The db transaction object
   */
  async onOfferOnlyEnabled(id: string, event: Event, txn?: Transaction) {
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
   * @param commission The market creator commission base point
   * @param numMediators The number of mediators
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
    commission: BigNumber,
    numMediators: BigNumber,
    event: Event,
    txn?: Transaction,
  ) {
    this.logger.log(`NewMarket: processing...`);

    let baseSymbol = '',
      quoteSymbol = '',
      baseDecimals: number,
      quoteDecimals: number;

    if (Market.isERC20(baseType)) {
      const baseToken = this.newContract(baseAsset, erc20ABI, this.provider);
      baseSymbol = (await baseToken.symbol()).toUpperCase();
      baseDecimals = (await baseToken.decimals()).toNumber();
    }

    if (Market.isERC20(quoteType)) {
      const quoteToken = this.newContract(quoteAsset, erc20ABI, this.provider);
      quoteSymbol = (await quoteToken.symbol()).toUpperCase();
      quoteDecimals = (await quoteToken.decimals()).toNumber();
    }

    if (Market.isERC721(baseType)) {
      const baseToken = this.newContract(baseAsset, erc721ABI, this.provider);
      baseSymbol = (await baseToken.symbol()).toUpperCase();
    }

    if (Market.isERC721(quoteType)) {
      const quoteToken = this.newContract(quoteAsset, erc721ABI, this.provider);
      quoteSymbol = (await quoteToken.symbol()).toUpperCase();
    }

    if (Market.isSynth(baseType)) {
      const token = findInSynthetic(baseAsset);
      if (token) {
        baseSymbol = token.symbol.toUpperCase();
        baseDecimals = token.decimals;
      }
    }

    if (Market.isSynth(quoteType)) {
      const token = findInSynthetic(quoteAsset);
      if (token) {
        quoteSymbol = token.symbol.toUpperCase();
        quoteDecimals = token.decimals;
      }
    }

    const market = await this.contracts.marketCore.getMarket(id, { blockTag: event.blockNumber });

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
        commission: commission.toNumber(),
        txHash: event.transactionHash,
        numMediators: numMediators.toNumber(),
        permPut: market.perms.put,
        permSwap: market.perms.swap,
        permMediate: market.perms.mediate,
        mediatorBond: market.mediatorBond.toString(),
      },
      txn,
    );

    return Promise.resolve(undefined);
  }

  /**
   * New address allowed to provide liquidity to a market
   * @param marketAddress The market ID
   * @param address The address approved
   * @param event The event object
   * @param txn The db transaction object
   */
  async onMarketPutAllowed(marketAddress: string, address: string, event: Event, txn?: Transaction) {
    await LiquidityProvider.create(
      {
        network: this.network,
        marketAddress,
        address,
      },
      txn,
    );

    // Notify approved user
    await this.notifSrv.notify(NotificationID.PutApproved, this.network, address, {
      marketAddress,
    });

    return Promise.resolve(undefined);
  }

  /**
   * New address revoked from providing liquidity to a market
   * @param marketAddress The market ID
   * @param address The address approved
   * @param event The event object
   * @param txn The db transaction object
   */
  async onMarketPutRevoked(marketAddress: string, address: string, event: Event, txn?: Transaction) {
    await LiquidityProvider.remove(this.network, marketAddress, address, txn);

    // Notify revoked user
    await this.notifSrv.notify(NotificationID.PutRevoked, this.network, address, {
      marketAddress,
    });

    return Promise.resolve(undefined);
  }

  /**
   * New mediator invited into a market
   * @param marketAddress The market ID
   * @param address The address of the invited mediator
   * @param event The event object
   * @param txn The db transaction object
   */
  async onInvitedMediator(marketAddress: string, address: string, event: Event, txn?: Transaction) {
    const invite = await InvitedMediator.findInviteByNetworkMarketIDAndAddress(
      this.network,
      marketAddress,
      address,
      txn,
    );

    if (!invite) {
      await InvitedMediator.create(
        {
          network: this.network,
          marketAddress,
          address,
        },
        txn,
      );
    }

    await this.notifSrv.notify(NotificationID.MediatorInviteReceived, this.network, address, {
      marketAddress,
    });

    return Promise.resolve(undefined);
  }

  /**
   * New mediator uninvited into a market
   * @param id The market ID
   * @param address The address of the uninvited mediator
   * @param event The event object
   * @param txn The db transaction object
   */
  async onUnInvitedMediator(id: string, address: string, event: Event, txn?: Transaction) {
    const invite = await InvitedMediator.findInviteByNetworkMarketIDAndAddress(this.network, id, address, txn);
    if (!invite.accepted) await InvitedMediator.remove(this.network, id, address, txn);
    return Promise.resolve(undefined);
  }

  /**
   * Invited mediator accepted an invitation
   * @param marketAddress The market ID
   * @param address The address of the uninvited mediator
   * @param event The event object
   * @param txn The db transaction object
   */
  async onAcceptedMediatorInvite(marketAddress: string, address: string, event: Event, txn?: Transaction) {
    await InvitedMediator.updateInvite(this.network, marketAddress, address, { accepted: true }, txn);

    // Notify market creator
    const market = await Market.getByAddress(marketAddress, txn);
    await this.notifSrv.notify(NotificationID.MediatorInviteAccepted, this.network, market.creator, {
      marketAddress,
      invitee: address,
    });

    return Promise.resolve(undefined);
  }

  /**
   * Mediator invite has been revoked.
   * @param marketAddress The market ID
   * @param address The address of the revoked mediator
   * @param event The event object
   * @param txn The db transaction object
   */
  async onRevokedMediator(marketAddress: string, address: string, event: Event, txn?: Transaction) {
    await InvitedMediator.remove(this.network, marketAddress, address, txn);

    // Notify mediator
    await this.notifSrv.notify(NotificationID.MediatorRevoked, this.network, address, {
      marketAddress,
    });

    return Promise.resolve(undefined);
  }

  /**
   * An address was approved for swapping
   * @param marketAddress The market ID
   * @param address The address of that was approved
   * @param event The event object
   * @param txn The db transaction object
   */
  async onAllowedSwap(marketAddress: string, address: string, event: Event, txn?: Transaction) {
    const perm = await PermittedTrader.findByNetworkMarketIdAndAddress(this.network, marketAddress, address, txn);
    if (!perm) {
      await PermittedTrader.create(
        {
          network: this.network,
          marketAddress,
          address,
        },
        txn,
      );

      await this.notifSrv.notify(NotificationID.SwapApproved, this.network, address, {
        marketAddress,
      });
    }

    return Promise.resolve(undefined);
  }

  /**
   * An address was revoked from swapping.
   * @param marketAddress The market ID
   * @param address The address that was revoked
   * @param event The event object
   * @param txn The db transaction object
   */
  async onRevokedSwap(marketAddress: string, address: string, event: Event, txn?: Transaction) {
    await PermittedTrader.remove(this.network, marketAddress, address, txn);
    await this.notifSrv.notify(NotificationID.SwapRevoked, this.network, address, {
      marketAddress,
    });
    return Promise.resolve(undefined);
  }

  /**
   * A market's commission has been set
   * @param id The market ID
   * @param value The updated value
   * @param event The event object
   * @param txn The db transaction object
   */
  async onUpdatedCommission(id: string, value: BigNumber, event: Event, txn?: Transaction) {
    await Market.updateByNetworkAddress(this.network, id, { commission: value.toNumber() }, txn);
  }

  /**
   * Updated dispute durations
   * @param id The market ID
   * @param disputeDelayTime Number of seconds before dispute can be started
   * @param evidenceDur Number of seconds within which evidence must be shared
   * @param predictDur Number of seconds for votes to be committed and revealed
   * @param appealDur Number of seconds within which an appeal must be created after prediction phase
   * @param event The event object
   * @param txn The db transaction object
   */
  async onUpdatedDisputeDurations(
    id: string,
    disputeDelayTime: BigNumber,
    evidenceDur: BigNumber,
    predictDur: BigNumber,
    appealDur: BigNumber,
    event: Event,
    txn?: Transaction,
  ) {
    await Market.updateByNetworkAddress(
      this.network,
      id,
      {
        disputeDelayTime: disputeDelayTime.toNumber(),
        evidenceDur: evidenceDur.toNumber(),
        predictDur: predictDur.toNumber(),
        appealDur: appealDur.toNumber(),
      },
      txn,
    );
  }

  /**
   * Updated market manager
   * @param id The market ID
   * @param managerAddr The new manager address
   * @param event The event object
   * @param txn The db transaction object
   */
  async onUpdatedMarketManager(id: string, managerAddr: string, event: Event, txn?: Transaction) {
    await Market.updateByNetworkAddress(this.network, id, { manager: managerAddr }, txn);
  }

  /**
   * Updated dispute cost
   * @param id The market ID
   * @param newCost The new dispute cost
   * @param event The event object
   * @param txn The db transaction object
   */
  async onUpdatedDisputeCost(id: string, newCost: BigNumber, event: Event, txn?: Transaction) {
    await Market.updateByNetworkAddress(this.network, id, { disputeCost: newCost.toString() }, txn);
  }
}
