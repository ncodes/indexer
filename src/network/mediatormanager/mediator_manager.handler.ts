import * as ethers from 'ethers';
import { Handler } from '../handler';

export class MediatorManagerHandler extends Handler {
  constructor(
    private provider: ethers.providers.JsonRpcProvider,
    public network: string,
    private contracts: KnownContracts,
  ) {
    super(network, contracts.mediatorMgr);
  }

  /**
   * Listen for events
   */
  listen() {
    this.on(
      'TicketPurchased',
      async (owner: string, id: number, amount: number, event: ethers.Event) => {
        return this.onTicketPurchased(owner, id, amount, event);
      },
    );

    this.on('TicketCancelled', async (owner: string, id: number, event: ethers.Event) => {
      return this.onTicketCancelled(owner, id, event);
    });

    this.on(
      'TicketDrained',
      async (owner: string, id: number, amount: number, event: ethers.Event) => {
        return this.onTicketDrained(owner, id, amount, event);
      },
    );

    this.on(
      'JoinedMarket',
      async (owner: string, marketId: string, ticketId: number, event: ethers.Event) => {
        return this.onJoinedMarket(owner, marketId, ticketId, event);
      },
    );

    this.on(
      'Drafted',
      async (marketId: string, owner: string, ticketId: number, event: ethers.Event) => {
        return this.onDrafted(marketId, owner, ticketId, event);
      },
    );

    this.on(
      'Undrafted',
      async (owner: string, ticketId: number, marketId: string, event: ethers.Event) => {
        return this.onUndrafted(owner, ticketId, marketId, event);
      },
    );

    this.on(
      'TicketSlashed',
      async (
        owner: string,
        ticketId: number,
        marketId: string,
        amount: number,
        event: ethers.Event,
      ) => {
        return this.onTicketSlashed(owner, ticketId, marketId, amount, event);
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
  async onTicketPurchased(owner: string, id: number, amount: number, event: ethers.Event) {}

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
  async onTicketDrained(owner: string, id: number, amount: number, event: ethers.Event) {}

  /**
   * A ticket joined a market
   * @param owner The ticket owner
   * @param marketId The ID of the market joined
   * @param ticketId The unique id of the ticket
   * @param event The event object
   */
  async onJoinedMarket(owner: string, marketId: string, ticketId: number, event: ethers.Event) {}

  /**
   * A ticket left a market
   * @param owner The ticket owner
   * @param marketId The ID of the market joined
   * @param ticketId The unique id of the ticket
   * @param event The event object
   */
  async onLeftMarket(owner: string, marketId: string, ticketId: number, event: ethers.Event) {}

  /**
   * A ticket was drafted to mediate
   * @param marketId The ID of the market the ticket joined
   * @param owner The ticket owner
   * @param ticketId The unique id of the ticket
   * @param event The event object
   */
  async onDrafted(marketId: string, owner: string, ticketId: number, event: ethers.Event) {}

  /**
   * A ticket was undrafted
   * @param owner The ticket owner
   * @param ticketId The unique id of the ticket
   * @param marketId The ID of the market the ticket joined
   * @param event The event object
   */
  async onUndrafted(owner: string, ticketId: number, marketId: string, event: ethers.Event) {}

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
