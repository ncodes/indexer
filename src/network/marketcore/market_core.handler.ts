import { Logger } from '@nestjs/common';
import { Contract, Event, providers } from 'ethers';
import { Transaction } from 'objection';
import * as erc20ABI from '../../../abi/erc20.json';
import Market from '../../models/market';
import { Handler } from '../handler';

export class MarketCoreHandler extends Handler {
  public logger = new Logger(MarketCoreHandler.name);
  constructor(
    private provider: providers.JsonRpcProvider,
    public network: string,
    private contracts: KnownContracts,
  ) {
    super(network);
  }

  /**
   * Listen for events
   */
  listen() {
    this.on(
      this.contracts.marketCore,
      'NewMarket',
      (
        id: string,
        owner: string,
        base: string,
        quote: string,
        isBaseLocal: boolean,
        isQuoteLocal: boolean,
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
          event,
          txn,
        );
      },
    );

    this.on(
      this.contracts.marketCore,
      'AllowedPut',
      async (id: string, address: string, event: Event) => {
        return this.onMarketPutAllowed(id, address, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'RevokedPut',
      async (id: string, address: string, event: Event) => {
        return this.onMarketPutRevoked(id, address, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'InvitedMediator',
      async (id: string, address: string, event: Event) => {
        return this.onInvitedMediator(id, address, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'UnInvitedMediator',
      async (id: string, address: string, event: Event) => {
        return this.onUnInvitedMediator(id, address, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'AcceptedMediatorInvite',
      async (id: string, address: string, event: Event) => {
        return this.onAcceptedMediatorInvite(id, address, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'RevokedMediator',
      async (id: string, address: string, event: Event) => {
        return this.onRevokedMediator(id, address, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'AllowedSwap',
      async (id: string, address: string, event: Event) => {
        return this.onAllowedSwap(id, address, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'RevokedSwap',
      async (id: string, address: string, event: Event) => {
        return this.onRevokedSwap(id, address, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'SetPutPerm',
      async (id: string, enabled: boolean, event: Event) => {
        return this.onSetPutPerm(id, enabled, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'SetSwapPerm',
      async (id: string, enabled: boolean, event: Event) => {
        return this.onSetSwapPerm(id, enabled, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'SetMediatorPerm',
      async (id: string, enabled: boolean, event: Event) => {
        return this.onSetMediatorPerm(id, enabled, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'SetCommission',
      async (id: string, value: string, event: Event) => {
        return this.onSetCommission(id, value, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'SetMinMediatorBond',
      async (id: string, value: string, event: Event) => {
        return this.onSetMinMediatorBond(id, value, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'SetLiquidityManager',
      async (id: string, provider: string, manager: string, event: Event) => {
        return this.onSetLiquidityManager(id, provider, manager, event);
      },
    );

    this.contracts.marketCore.on(
      'RemoveLiquidityManager',
      async (id: string, provider: string, manager: string, event: Event) => {
        return this.onRemoveLiquidityManager(id, provider, manager, event);
      },
    );
  }

  /**
   * New market creation
   * @param id The market ID
   * @param owner The address of the market creator
   * @param baseAsset The base asset of the market
   * @param quoteAsset The quote asset of the market
   * @param isBaseLocal Indicates whether the base asset is local
   * @param isQuoteLocal Indicates whether the quote asset is local
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
    event: Event,
    txn: Transaction,
  ) {
    this.logger.log(`New Market (${id}) by account:${owner}`);
    const baseToken = new Contract(baseAsset, erc20ABI, this.provider);
    const quoteToken = new Contract(quoteAsset, erc20ABI, this.provider);
    const market = await this.contracts.marketCore.getMarket(
      Buffer.from(id.substring(2), 'hex'),
    );

    const base = (await baseToken.symbol()).toUpperCase();
    const quote = (await quoteToken.symbol()).toUpperCase();

    await Market.create(
      {
        mid: id,
        creator: owner,
        base,
        baseAddress: baseAsset,
        isBaseLocal: market.base.isLocal,
        quote,
        quoteAddress: quoteAsset,
        isQuoteLocal: market.quote.isLocal,
        pair: `${base}${quote}`,
        network: this.network,
      },
      txn,
    );
  }

  /**
   * New address allowed to provide liquidity to a market
   * @param id The market ID
   * @param address The address approved
   */
  async onMarketPutAllowed(id: string, address: string, event: Event) {
    //
  }

  /**
   * New address revoked from providing liquidity to a market
   * @param id The market ID
   * @param address The address approved
   */
  async onMarketPutRevoked(id: string, address: string, event: Event) {
    //
  }

  /**
   * New mediator invited into a market
   * @param id The market ID
   * @param address The address of the invited mediator
   */
  async onInvitedMediator(id: string, address: string, event: Event) {
    //
  }

  /**
   * New mediator uninvited into a market
   * @param id The market ID
   * @param address The address of the uninvited mediator
   */
  async onUnInvitedMediator(id: string, address: string, event: Event) {
    //
  }

  /**
   * Invited mediator accepted an invite
   * @param id The market ID
   * @param address The address of the uninvited mediator
   */
  async onAcceptedMediatorInvite(id: string, address: string, event: Event) {
    //
  }

  /**
   * Mediator invite has been revoked.
   * @param id The market ID
   * @param address The address of the revoked mediator
   */
  async onRevokedMediator(id: string, address: string, event: Event) {
    //
  }

  /**
   * An address was approved for swapping
   * @param id The market ID
   * @param address The address of that was approved
   */
  async onAllowedSwap(id: string, address: string, event: Event) {
    //
  }

  /**
   * An address was revoked from swapping.
   * @param id The market ID
   * @param address The address that was revoked
   */
  async onRevokedSwap(id: string, address: string, event: Event) {
    //
  }

  /**
   * Enabled or disabled permissioned liquidity provisioning
   * @param id The market ID
   * @param enabled The new state
   */
  async onSetPutPerm(id: string, enabled: boolean, event: Event) {
    //
  }

  /**
   * Enabled or disabled permissioned swapping
   * @param id The market ID
   * @param enabled The new state
   */
  async onSetSwapPerm(id: string, enabled: boolean, event: Event) {
    //
  }

  /**
   * Enabled or disabled permissioned mediation
   * @param id The market ID
   * @param enabled The new state
   */
  async onSetMediatorPerm(id: string, enabled: boolean, event: Event) {
    //
  }

  /**
   * A market's commission has been set
   * @param id The market ID
   * @param value The updated value
   */
  async onSetCommission(id: string, value: string, event: Event) {
    //
  }

  /**
   * The minimum market mediator bond was updated
   * @param id The market ID
   * @param value The updated value
   */
  async onSetMinMediatorBond(id: string, value: string, event: Event) {
    //
  }

  /**
   * A liquidity manager has been set for a specific liquidity
   * @param id The market ID
   * @param provider The liquidity provider's address
   * @param manager The liquidity manager's address
   */
  async onSetLiquidityManager(
    id: string,
    provider: string,
    manager: string,
    event: Event,
  ) {
    //
  }

  /**
   * A liquidity manager has been removed for a specific liquidity
   * @param id The market ID
   * @param provider The liquidity provider's address
   * @param manager The liquidity manager's address
   */
  async onRemoveLiquidityManager(
    id: string,
    provider: string,
    manager: string,
    event: Event,
  ) {
    //
  }
}
