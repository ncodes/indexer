import { BigNumber, ethers, Event, providers } from 'ethers';
import { Handler } from '../handler';

export class DisputeManagerHandler extends Handler {
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
      this.contracts.disputeMgr,
      'DisputeCreated',
      (
        orderId: BigNumber,
        creator: string,
        disputeId: BigNumber,
        event: ethers.Event,
      ) => {
        this.onDisputeCreated(orderId, creator, disputeId, event);
      },
    );

    this.on(
      this.contracts.disputeMgr,
      'DraftedMediator',
      (
        orderId: BigNumber,
        mediator: string,
        ticketId: BigNumber,
        drafter: string,
        event: ethers.Event,
      ) => {
        this.onDraftedMediator(orderId, mediator, ticketId, drafter, event);
      },
    );

    this.on(
      this.contracts.disputeMgr,
      'Committed',
      (
        orderId: BigNumber,
        committer: string,
        hash: string,
        event: ethers.Event,
      ) => {
        this.onCommitted(orderId, committer, hash, event);
      },
    );

    this.on(
      this.contracts.disputeMgr,
      'Revealed',
      (
        orderId: BigNumber,
        revealer: string,
        vote: string,
        event: ethers.Event,
      ) => {
        this.onRevealed(orderId, revealer, vote, event);
      },
    );

    this.on(
      this.contracts.disputeMgr,
      'WithdrawnReward',
      (claimer: string, amount: BigNumber, event: ethers.Event) => {
        this.onWithdrawnReward(claimer, amount, event);
      },
    );

    this.on(
      this.contracts.disputeMgr,
      'Drafted',
      (
        marketId: string,
        owner: string,
        ticketId: BigNumber,
        event: ethers.Event,
      ) => {
        this.onDrafted(marketId, owner, ticketId, event);
      },
    );

    this.on(
      this.contracts.disputeMgr,
      'Undrafted',
      (
        marketId: string,
        owner: string,
        ticketId: BigNumber,
        event: ethers.Event,
      ) => {
        this.onUndrafted(marketId, owner, ticketId, event);
      },
    );

    this.on(
      this.contracts.disputeMgr,
      'DecisionExecuted',
      (
        orderId: BigNumber,
        executor: string,
        alreadyReleased: boolean,
        winningVote: string,
        execReward: BigNumber,
        event: ethers.Event,
      ) => {
        this.onDecisionExecuted(
          orderId,
          executor,
          alreadyReleased,
          winningVote,
          execReward,
          event,
        );
      },
    );
  }

  /**
   * A dispute was created
   * @param orderId The order ID
   * @param creator The address of the dispute creator
   * @param disputeId The dispute ID
   * @param event The event object
   */
  async onDisputeCreated(
    orderId: BigNumber,
    creator: string,
    disputeId: BigNumber,
    event: Event,
  ) {}

  /**
   * A mediator was drafted
   * @param orderId The order ID
   * @param mediator The drafted mediator's address
   * @param ticketId The ticket ID
   * @param drafter The address of the drafter
   * @param event The event object
   */
  async onDraftedMediator(
    orderId: BigNumber,
    mediator: string,
    ticketId: BigNumber,
    drafter: string,
    event: Event,
  ) {}

  /**
   * A mediator committed a hash for a vote
   * @param orderId The order ID
   * @param committer The address of the mediator
   * @param hash The hash committed
   * @param event The event object
   */
  async onCommitted(
    orderId: BigNumber,
    committer: string,
    hash: string,
    event: Event,
  ) {}

  /**
   * A mediator revealed a committed vote
   * @param orderId The order ID
   * @param revealer The address of the mediator
   * @param vote The revealed vote
   * @param event The event object
   */
  async onRevealed(
    orderId: BigNumber,
    revealer: string,
    vote: string,
    event: Event,
  ) {}

  /**
   * Some reward was withdrawn
   * @param claimer The address of the withdrawer
   * @param amount The amount withdrawn
   * @param event The event object
   */
  async onWithdrawnReward(claimer: string, amount: BigNumber, event: Event) {}

  /**
   * A ticket was drafted to a dispute
   * @param marketId The market ID
   * @param owner The address of the owner of the drafted ticket
   * @param ticketId The drafted ticket ID
   * @param event The event object
   */
  async onDrafted(
    marketId: string,
    owner: string,
    ticketId: BigNumber,
    event: Event,
  ) {}

  /**
   * A ticket was undrafted from a dispute
   * @param marketId The market ID
   * @param owner The address of the owner of the drafted ticket
   * @param ticketId The drafted ticket ID
   * @param event The event object
   */
  async onUndrafted(
    marketId: string,
    owner: string,
    ticketId: BigNumber,
    event: Event,
  ) {}

  /**
   * A dispute outcome was executed
   * @param orderId The order ID
   * @param executor The address dispute outcome executed
   * @param alreadyReleased Indicate the order was already released prior to execution.
   * @param winningVote The vote that was predicted by the majority.
   * @param execReward The reward paid to the executor.
   * @param event The event object
   */
  async onDecisionExecuted(
    orderId: BigNumber,
    executor: string,
    alreadyReleased: boolean,
    winningVote: string,
    execReward: BigNumber,
    event: Event,
  ) {}
}
