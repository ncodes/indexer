import { Logger } from '@nestjs/common';
import { BigNumber, Event, providers } from 'ethers';
import { Transaction } from 'objection';
import * as erc20ABI from '../../../abi/erc20.json';
import Market from '../../models/market';
import { Handler } from '../handler';
import LiquidityProvider from '../../models/market_provider';
import InvitedMediator from '../../models/invited_mediators';
import PermittedTrader from '../../models/permitted_trader';
import { NotifierService, NotifyType } from '../../jobs/mailer/NotifierService';
import NetworkService from '../network.service';

export class MarketCoreHandler extends Handler {
  public logger = new Logger(MarketCoreHandler.name);
  constructor(
    private netSrv: NetworkService,
    private notifSrv: NotifierService,
    private provider: providers.JsonRpcProvider,
    public network: string,
    private contracts: JointContracts,
  ) {
    super(netSrv.cfgSrv, network, contracts.marketCore);
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
        baseType: BigNumber,
        quoteType: BigNumber,
        commission: BigNumber,
        numMediators: BigNumber,
        event: Event,
        txn: Transaction,
      ) => {
        return this.onNewMarket(
          id,
          owner,
          base,
          quote,
          baseType,
          quoteType,
          commission,
          numMediators,
          event,
          txn,
        );
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

    this.on('UpdatedMinMediatorBond', async (id: string, value: BigNumber, event: Event) => {
      return this.onUpdatedMinMediatorBond(id, value, event);
    });

    this.on('OfferOnlyEnabled', async (id: string, event: Event) => {
      return this.onOfferOnlyEnabled(id, event);
    });

    this.on(
      'TransferredOwnership',
      async (id: string, oldOwner: string, newOwner: string, event: Event) => {
        return this.onTransferredOwnership(id, oldOwner, newOwner, event);
      },
    );

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
      ) => {
        return this.onUpdatedMarketBadges(id, put, swap, mediate, event);
      },
    );

    this.on('UpdatedBadgeAddr', async (addr: string, event: Event) => {
      return;
    });

    this.on('UpdatedRewardPoolAddr', async (addr: string, event: Event) => {
      return;
    });

    this.on('UpdatedDefaultMediatorBond', async (newValue: BigNumber, event: Event) => {
      return;
    });

    this.on('UpdatedDefaultDisputeDelayTime', async (newValue: BigNumber, event: Event) => {
      return;
    });

    this.on(
      'UpdatedDisputeDurations',
      async (
        id: string,
        disputeDelayTime: BigNumber,
        evidenceDur: BigNumber,
        predictDur: BigNumber,
        appealDur: BigNumber,
        event: Event,
      ) => {
        return;
      },
    );

    this.on('SetPutPerm', async (id: string, enabled: boolean, event: Event) => {
      return this.onSetPutPerm(id, enabled, event);
    });

    this.on('UpdatedMarketManager', async (id: string, mgrAdr: string, event: Event) => {
      return;
    });

    this.on('UpdatedDisputeCost', async (id: string, newCost: BigNumber, event: Event) => {
      return;
    });
  }

  async onUpdatedMarketBadges(
    id: string,
    put: [string, string][],
    swap: [string, string][],
    mediate: [string, string][],
    event: Event,
  ) {
    return;
  }

  async onZeroPriceEnabled(id: string, event: Event) {
    return;
  }

  async onTransferredOwnership(id: string, oldOwner: string, newOwner: string, event: Event) {
    return;
  }

  async onOfferOnlyEnabled(id: string, event: Event) {
    return;
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
    baseType: BigNumber,
    quoteType: BigNumber,
    commission: BigNumber,
    numMediators: BigNumber,
    event: Event,
    txn?: Transaction,
  ) {
    this.logger.log(`NewMarket: processing...`);
    const baseToken = this.newContract(baseAsset, erc20ABI, this.provider);
    const quoteToken = this.newContract(quoteAsset, erc20ABI, this.provider);
    const base = (await baseToken.symbol()).toUpperCase();
    const quote = (await quoteToken.symbol()).toUpperCase();
    const mc = this.netSrv.getMarketCore(this.network);
    const market = await mc.getMarket(id, { blockTag: event.blockNumber });
    await Market.create(
      {
        address: id,
        creator: owner,
        base,
        baseAddress: baseAsset,
        baseType: baseType.toNumber(),
        quote,
        quoteAddress: quoteAsset,
        quoteType: quoteType.toNumber(),
        instant: Market.isInstant(baseType.toNumber(), quoteType.toNumber()),
        pair: `${base}${quote}`,
        network: this.network,
        commission: commission.toNumber(),
        txHash: event.transactionHash,
        numMediators: numMediators.toNumber(),
        permPut: market.permPut,
        permSwap: market.permSwap,
        permMediate: market.permMediate,
        mediatorBond: market.mediatorBond.toString(),
      },
      txn,
    );

    return Promise.resolve(undefined);
  }

  /**
   * Enabled or disabled permissioned liquidity provisioning
   * @param id The market ID
   * @param enabled The new state
   * @param event
   */
  async onSetPutPerm(id: string, enabled: boolean, event: Event) {
    // no implementation yet
  }

  /**
   * New address allowed to provide liquidity to a market
   * @param marketAddress The market ID
   * @param address The address approved
   * @param event The event object
   * @param txn The db transaction object
   */
  async onMarketPutAllowed(
    marketAddress: string,
    address: string,
    event: Event,
    txn?: Transaction,
  ) {
    await LiquidityProvider.create(
      {
        network: this.network,
        marketAddress,
        address,
      },
      txn,
    );

    // Notify approved user
    await this.notifSrv.notify(NotifyType.PutApproved, this.network, address, {
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
  async onMarketPutRevoked(
    marketAddress: string,
    address: string,
    event: Event,
    txn?: Transaction,
  ) {
    await LiquidityProvider.remove(this.network, marketAddress, address, txn);

    // Notify revoked user
    await this.notifSrv.notify(NotifyType.PutRevoked, this.network, address, {
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
    await this.notifSrv.notify(NotifyType.MediationInviteReceived, this.network, address, {
      marketAddress,
    });
  }

  /**
   * New mediator uninvited into a market
   * @param id The market ID
   * @param address The address of the uninvited mediator
   * @param event The event object
   * @param txn The db transaction object
   */
  async onUnInvitedMediator(id: string, address: string, event: Event, txn?: Transaction) {
    const invite = await InvitedMediator.findInviteByNetworkMarketIDAndAddress(
      this.network,
      id,
      address,
      txn,
    );
    if (!invite.accepted) await InvitedMediator.remove(this.network, id, address, txn);
  }

  /**
   * Invited mediator accepted an invitation
   * @param marketAddress The market ID
   * @param address The address of the uninvited mediator
   * @param event The event object
   * @param txn The db transaction object
   */
  async onAcceptedMediatorInvite(
    marketAddress: string,
    address: string,
    event: Event,
    txn?: Transaction,
  ) {
    await InvitedMediator.updateInvite(
      this.network,
      marketAddress,
      address,
      { accepted: true },
      txn,
    );

    // Notify market creator
    const market = await Market.getByAddress(marketAddress, txn);
    await this.notifSrv.notify(NotifyType.MediatorInviteAccepted, this.network, market.creator, {
      marketAddress,
      invitee: address,
    });
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
    await this.notifSrv.notify(NotifyType.MediatorRevoked, this.network, address, {
      marketAddress,
    });
  }

  /**
   * An address was approved for swapping
   * @param marketAddress The market ID
   * @param address The address of that was approved
   * @param event The event object
   * @param txn The db transaction object
   */
  async onAllowedSwap(marketAddress: string, address: string, event: Event, txn?: Transaction) {
    const perm = await PermittedTrader.findByNetworkMarketIdAndAddress(
      this.network,
      marketAddress,
      address,
      txn,
    );
    if (!perm) {
      await PermittedTrader.create(
        {
          network: this.network,
          marketAddress,
          address,
        },
        txn,
      );

      await this.notifSrv.notify(NotifyType.SwapApproved, this.network, address, {
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
    await this.notifSrv.notify(NotifyType.SwapRevoked, this.network, address, {
      marketAddress,
    });
    return Promise.resolve(undefined);
  }

  /**
   * A market's commission has been set
   * @param id The market ID
   * @param value The updated value
   * @param event
   */
  async onUpdatedCommission(id: string, value: BigNumber, event: Event) {
    //
  }

  /**
   * The minimum market mediator bond was updated
   * @param id The market ID
   * @param value The updated value
   * @param event
   */
  async onUpdatedMinMediatorBond(id: string, value: BigNumber, event: Event) {
    //
  }
}
