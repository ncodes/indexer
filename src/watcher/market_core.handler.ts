import { Logger } from '@nestjs/common';
import { Event } from 'ethers';
import Market from '../models/market';
import { Handler } from './handler';

export class MarketCoreHandler extends Handler {
  public logger = new Logger(MarketCoreHandler.name);
  constructor(private contracts: KnownContracts) {
    super();
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
        event: Event,
      ) => {
        this.onNewMarket(id, owner, base, quote, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'AllowedPut',
      (id: string, address: string, event: Event) => {
        this.onMarketPutAllowed(id, address, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'RevokedPut',
      (id: string, address: string, event: Event) => {
        this.onMarketPutRevoked(id, address, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'InvitedMediator',
      (id: string, address: string, event: Event) => {
        this.onInvitedMediator(id, address, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'UnInvitedMediator',
      (id: string, address: string, event: Event) => {
        this.onUnInvitedMediator(id, address, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'AcceptedMediatorInvite',
      (id: string, address: string, event: Event) => {
        this.onAcceptedMediatorInvite(id, address, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'RevokedMediator',
      (id: string, address: string, event: Event) => {
        this.onRevokedMediator(id, address, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'AllowedSwap',
      (id: string, address: string, event: Event) => {
        this.onAllowedSwap(id, address, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'RevokedSwap',
      (id: string, address: string, event: Event) => {
        this.onRevokedSwap(id, address, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'SetPutPerm',
      (id: string, enabled: boolean, event: Event) => {
        this.onSetPutPerm(id, enabled, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'SetSwapPerm',
      (id: string, enabled: boolean, event: Event) => {
        this.onSetSwapPerm(id, enabled, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'SetMediatorPerm',
      (id: string, enabled: boolean, event: Event) => {
        this.onSetMediatorPerm(id, enabled, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'SetCommission',
      (id: string, value: string, event: Event) => {
        this.onSetCommission(id, value, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'SetMinMediatorBond',
      (id: string, value: string, event: Event) => {
        this.onSetMinMediatorBond(id, value, event);
      },
    );

    this.on(
      this.contracts.marketCore,
      'SetLiquidityManager',
      (id: string, provider: string, manager: string, event: Event) => {
        this.onSetLiquidityManager(id, provider, manager, event);
      },
    );

    this.contracts.marketCore.on(
      'RemoveLiquidityManager',
      (id: string, provider: string, manager: string, event: Event) => {
        this.onRemoveLiquidityManager(id, provider, manager, event);
      },
    );
  }

  /**
   * New market creation
   * @param id The market ID
   * @param owner The address of the market creator
   * @param baseAsset The base asset of the market
   * @param quoteAsset The quote asset of the market
   * @param event The event object
   */
  async onNewMarket(
    id: string,
    owner: string,
    baseAsset: string,
    quoteAsset: string,
    event: Event,
  ) {
    this.logger.log(`New Market (${id}) by account:${owner}`);
    await Market.create({
      mid: id,
      creator: owner,
      base: baseAsset,
      quote: quoteAsset,
      blockNumber: event.blockNumber,
      blockHash: event.blockHash,
    });
  }

  /**
   * New address allowed to provide liquidity to a market
   * @param id The market ID
   * @param address The address approved
   */
  onMarketPutAllowed(id: string, address: string, event: Event) {
    //
  }

  /**
   * New address revoked from providing liquidity to a market
   * @param id The market ID
   * @param address The address approved
   */
  onMarketPutRevoked(id: string, address: string, event: Event) {
    //
  }

  /**
   * New mediator invited into a market
   * @param id The market ID
   * @param address The address of the invited mediator
   */
  onInvitedMediator(id: string, address: string, event: Event) {
    //
  }

  /**
   * New mediator uninvited into a market
   * @param id The market ID
   * @param address The address of the uninvited mediator
   */
  onUnInvitedMediator(id: string, address: string, event: Event) {
    //
  }

  /**
   * Invited mediator accepted an invite
   * @param id The market ID
   * @param address The address of the uninvited mediator
   */
  onAcceptedMediatorInvite(id: string, address: string, event: Event) {
    //
  }

  /**
   * Mediator invite has been revoked.
   * @param id The market ID
   * @param address The address of the revoked mediator
   */
  onRevokedMediator(id: string, address: string, event: Event) {
    //
  }

  /**
   * An address was approved for swapping
   * @param id The market ID
   * @param address The address of that was approved
   */
  onAllowedSwap(id: string, address: string, event: Event) {
    //
  }

  /**
   * An address was revoked from swapping.
   * @param id The market ID
   * @param address The address that was revoked
   */
  onRevokedSwap(id: string, address: string, event: Event) {
    //
  }

  /**
   * Enabled or disabled permissioned liquidity provisioning
   * @param id The market ID
   * @param enabled The new state
   */
  onSetPutPerm(id: string, enabled: boolean, event: Event) {
    //
  }

  /**
   * Enabled or disabled permissioned swapping
   * @param id The market ID
   * @param enabled The new state
   */
  onSetSwapPerm(id: string, enabled: boolean, event: Event) {
    //
  }

  /**
   * Enabled or disabled permissioned mediation
   * @param id The market ID
   * @param enabled The new state
   */
  onSetMediatorPerm(id: string, enabled: boolean, event: Event) {
    //
  }

  /**
   * A market's commission has been set
   * @param id The market ID
   * @param value The updated value
   */
  onSetCommission(id: string, value: string, event: Event) {
    //
  }

  /**
   * The minimum market mediator bond was updated
   * @param id The market ID
   * @param value The updated value
   */
  onSetMinMediatorBond(id: string, value: string, event: Event) {
    //
  }

  /**
   * A liquidity manager has been set for a specific liquidity
   * @param id The market ID
   * @param provider The liquidity provider's address
   * @param manager The liquidity manager's address
   */
  onSetLiquidityManager(
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
  onRemoveLiquidityManager(
    id: string,
    provider: string,
    manager: string,
    event: Event,
  ) {
    //
  }
}
