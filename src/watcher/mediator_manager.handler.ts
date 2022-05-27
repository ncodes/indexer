import * as ethers from 'ethers';
import { Handler } from './handler';

export class MediatorManagerHandler extends Handler {
  constructor(private contracts: KnownContracts) {
    super();
  }

  /**
   * Listen for events
   */
  listen() {
    this.on(
      this.contracts.mediatorMgr,
      'TicketPurchased',
      (owner: string, id: number, amount: number, event: ethers.Event) => {
        this.onTicketPurchased(owner, id, amount, event);
      },
    );

    this.on(
      this.contracts.mediatorMgr,
      'TicketCancelled',
      (owner: string, id: number, event: ethers.Event) => {
        this.onTicketCancelled(owner, id, event);
      },
    );

    this.on(
      this.contracts.mediatorMgr,
      'TicketDrained',
      (owner: string, id: number, amount: number, event: ethers.Event) => {
        this.onTicketDrained(owner, id, amount, event);
      },
    );

    this.on(
      this.contracts.mediatorMgr,
      'JoinedMarket',
      (
        owner: string,
        marketId: string,
        ticketId: number,
        event: ethers.Event,
      ) => {
        this.onJoinedMarket(owner, marketId, ticketId, event);
      },
    );

    this.on(
      this.contracts.mediatorMgr,
      'Drafted',
      (
        marketId: string,
        owner: string,
        ticketId: number,
        event: ethers.Event,
      ) => {
        this.onDrafted(marketId, owner, ticketId, event);
      },
    );

    this.on(
      this.contracts.mediatorMgr,
      'Undrafted',
      (
        owner: string,
        ticketId: number,
        marketId: string,
        event: ethers.Event,
      ) => {
        this.onUndrafted(owner, ticketId, marketId, event);
      },
    );

    this.on(
      this.contracts.mediatorMgr,
      'TicketSlashed',
      (
        owner: string,
        ticketId: number,
        marketId: string,
        amount: number,
        event: ethers.Event,
      ) => {
        this.onTicketSlashed(owner, ticketId, marketId, amount, event);
      },
    );
  }

  /**
   * A ticket was purchased
   * @param owner The address of the ticket purchaser
   * @param id The unique id of the ticket
   * @param amount The amount locked in the ticket
   * @param event The event object
   */
  async onTicketPurchased(
    owner: string,
    id: number,
    amount: number,
    event: ethers.Event,
  ) {}

  /**
   * A ticket was cancelled
   * @param owner The ticket owner
   * @param id The unique id of the ticket
   * @param event The event object
   */
  async onTicketCancelled(owner: string, id: number, event: ethers.Event) {}

  /**
   * A ticket was drained
   * @param owner The ticket owner
   * @param id The unique id of the ticket
   * @param amount The amount drained from the ticket
   * @param event The event object
   */
  async onTicketDrained(
    owner: string,
    id: number,
    amount: number,
    event: ethers.Event,
  ) {}

  /**
   * A ticket joined a market
   * @param owner The ticket owner
   * @param marketId The ID of the market joined
   * @param ticketId The unique id of the ticket
   * @param event The event object
   */
  async onJoinedMarket(
    owner: string,
    marketId: string,
    ticketId: number,
    event: ethers.Event,
  ) {}

  /**
   * A ticket left a market
   * @param owner The ticket owner
   * @param marketId The ID of the market joined
   * @param ticketId The unique id of the ticket
   * @param event The event object
   */
  async onLeftMarket(
    owner: string,
    marketId: string,
    ticketId: number,
    event: ethers.Event,
  ) {}

  /**
   * A ticket was drafted to mediate
   * @param marketId The ID of the market the ticket joined
   * @param owner The ticket owner
   * @param ticketId The unique id of the ticket
   * @param event The event object
   */
  async onDrafted(
    marketId: string,
    owner: string,
    ticketId: number,
    event: ethers.Event,
  ) {}

  /**
   * A ticket was undrafted
   * @param owner The ticket owner
   * @param ticketId The unique id of the ticket
   * @param marketId The ID of the market the ticket joined
   * @param event The event object
   */
  async onUndrafted(
    owner: string,
    ticketId: number,
    marketId: string,
    event: ethers.Event,
  ) {}

  /**
   * A ticket was slashed
   * @param owner The ticket owner
   * @param ticketId The unique id of the ticket
   * @param marketId The ID of the market the ticket joined
   * @param amount The amount that was slashed
   * @param event The event object
   */
  async onTicketSlashed(
    owner: string,
    ticketId: number,
    marketId: string,
    amount: number,
    event: ethers.Event,
  ) {}
}
