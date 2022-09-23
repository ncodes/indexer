import { Logger } from '@nestjs/common';
import { Event, providers } from 'ethers';
import { Transaction } from 'objection';
import * as erc20ABI from '../../../abi/erc20.json';
import Market from '../../models/market';
import { Handler } from '../handler';
import MarketProvider from '../../models/market_provider';
import InvitedMediator from '../../models/invited_mediators';
import PermittedTrader from '../../models/permitted_trader';
import { BigNumber } from 'ethers';
import { NotifierService, NotifyType } from '../../jobs/mailer/NotifierService';
import NetworkService from '../network.service';

export class MarketCoreHandler extends Handler {
  public logger = new Logger(MarketCoreHandler.name);
  constructor(
    private netSrv: NetworkService,
    private notifSrv: NotifierService,
    private provider: providers.JsonRpcProvider,
    public network: string,
    private contracts: KnownContracts,
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
        isBaseLocal: boolean,
        isQuoteLocal: boolean,
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
          isBaseLocal,
          isQuoteLocal,
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

    this.on('SetPutPerm', async (id: string, enabled: boolean, event: Event) => {
      return this.onSetPutPerm(id, enabled, event);
    });

    this.on('SetSwapPerm', async (id: string, enabled: boolean, event: Event) => {
      return this.onSetSwapPerm(id, enabled, event);
    });

    this.on('SetMediatorPerm', async (id: string, enabled: boolean, event: Event) => {
      return this.onSetMediatorPerm(id, enabled, event);
    });

    this.on('SetCommission', async (id: string, value: string, event: Event) => {
      return this.onSetCommission(id, value, event);
    });

    this.on('SetMinMediatorBond', async (id: string, value: string, event: Event) => {
      return this.onSetMinMediatorBond(id, value, event);
    });
  }

  /**
   * New market creation
   * @param id The market ID
   * @param owner The address of the market creator
   * @param baseAsset The base asset of the market
   * @param quoteAsset The quote asset of the market
   * @param isBaseLocal Indicates whether the base asset is local
   * @param isQuoteLocal Indicates whether the quote asset is local
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
    isBaseLocal: boolean,
    isQuoteLocal: boolean,
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
    const market = await mc.getMarket(id);
    await Market.create(
      {
        marketId: id,
        creator: owner,
        base,
        baseAddress: baseAsset,
        isBaseLocal,
        quote,
        quoteAddress: quoteAsset,
        isQuoteLocal,
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
   * @param marketId The market ID
   * @param address The address approved
   * @param event The event object
   * @param txn The db transaction object
   */
  async onMarketPutAllowed(marketId: string, address: string, event: Event, txn?: Transaction) {
    await MarketProvider.create(
      {
        network: this.network,
        marketId,
        address,
      },
      txn,
    );

    // Notify approved user
    await this.notifSrv.notify(NotifyType.PutApproved, this.network, address, {
      marketId,
    });

    return Promise.resolve(undefined);
  }

  /**
   * New address revoked from providing liquidity to a market
   * @param marketId The market ID
   * @param address The address approved
   * @param event The event object
   * @param txn The db transaction object
   */
  async onMarketPutRevoked(marketId: string, address: string, event: Event, txn?: Transaction) {
    await MarketProvider.remove(this.network, marketId, address, txn);

    // Notify revoked user
    await this.notifSrv.notify(NotifyType.PutRevoked, this.network, address, {
      marketId,
    });

    return Promise.resolve(undefined);
  }

  /**
   * Enabled or disabled permissioned mediation
   * @param id The market ID
   * @param enabled The new state
   * @param event
   */
  async onSetMediatorPerm(id: string, enabled: boolean, event: Event) {
    // no implementation yet
  }

  /**
   * New mediator invited into a market
   * @param marketId The market ID
   * @param address The address of the invited mediator
   * @param event The event object
   * @param txn The db transaction object
   */
  async onInvitedMediator(marketId: string, address: string, event: Event, txn?: Transaction) {
    const invite = await InvitedMediator.findInviteByNetworkMarketIDAndAddress(
      this.network,
      marketId,
      address,
      txn,
    );
    if (!invite) {
      await InvitedMediator.create(
        {
          network: this.network,
          marketId,
          address,
        },
        txn,
      );
    }
    await this.notifSrv.notify(NotifyType.MediationInviteReceived, this.network, address, {
      marketId,
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
   * @param marketId The market ID
   * @param address The address of the uninvited mediator
   * @param event The event object
   * @param txn The db transaction object
   */
  async onAcceptedMediatorInvite(
    marketId: string,
    address: string,
    event: Event,
    txn?: Transaction,
  ) {
    await InvitedMediator.updateInvite(this.network, marketId, address, { accepted: true }, txn);

    // Notify market creator
    const market = await Market.getByMarketId(marketId, txn);
    await this.notifSrv.notify(NotifyType.MediatorInviteAccepted, this.network, market.creator, {
      marketId,
      invitee: address,
    });
  }

  /**
   * Mediator invite has been revoked.
   * @param marketId The market ID
   * @param address The address of the revoked mediator
   * @param event The event object
   * @param txn The db transaction object
   */
  async onRevokedMediator(marketId: string, address: string, event: Event, txn?: Transaction) {
    await InvitedMediator.remove(this.network, marketId, address, txn);

    // Notify mediator
    await this.notifSrv.notify(NotifyType.MediatorRevoked, this.network, address, {
      marketId,
    });
  }

  /**
   * Enabled or disabled permissioned swapping
   * @param id The market ID
   * @param enabled The new state
   * @param event
   */
  async onSetSwapPerm(id: string, enabled: boolean, event: Event) {
    // no implementation yet
  }

  /**
   * An address was approved for swapping
   * @param marketId The market ID
   * @param address The address of that was approved
   * @param event The event object
   * @param txn The db transaction object
   */
  async onAllowedSwap(marketId: string, address: string, event: Event, txn?: Transaction) {
    const perm = await PermittedTrader.findByNetworkMarketIdAndAddress(
      this.network,
      marketId,
      address,
      txn,
    );
    if (!perm) {
      await PermittedTrader.create(
        {
          network: this.network,
          marketId,
          address,
        },
        txn,
      );

      await this.notifSrv.notify(NotifyType.SwapApproved, this.network, address, {
        marketId,
      });
    }

    return Promise.resolve(undefined);
  }

  /**
   * An address was revoked from swapping.
   * @param marketId The market ID
   * @param address The address that was revoked
   * @param event The event object
   * @param txn The db transaction object
   */
  async onRevokedSwap(marketId: string, address: string, event: Event, txn?: Transaction) {
    await PermittedTrader.remove(this.network, marketId, address, txn);
    await this.notifSrv.notify(NotifyType.SwapRevoked, this.network, address, {
      marketId,
    });
    return Promise.resolve(undefined);
  }

  /**
   * A market's commission has been set
   * @param id The market ID
   * @param value The updated value
   * @param event
   */
  async onSetCommission(id: string, value: string, event: Event) {
    //
  }

  /**
   * The minimum market mediator bond was updated
   * @param id The market ID
   * @param value The updated value
   * @param event
   */
  async onSetMinMediatorBond(id: string, value: string, event: Event) {
    //
  }
}
