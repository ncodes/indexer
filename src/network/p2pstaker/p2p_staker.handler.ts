import { BigNumber, Event, providers } from 'ethers';
import { Handler } from '../handler';

export class P2PStakerHandler extends Handler {
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
      this.contracts.p2pStaker,
      'Staked',
      (account: string, amount: BigNumber, event: Event) => {
        this.onStaked(account, amount, event);
      },
    );

    this.on(
      this.contracts.p2pStaker,
      'VestStaked',
      (account: string, amount: BigNumber, event: Event) => {
        this.onVestStaked(account, amount, event);
      },
    );

    this.on(
      this.contracts.p2pStaker,
      'StakeWithdrawn',
      (account: string, amount: BigNumber, event: Event) => {
        this.onStakeWithdrawn(account, amount, event);
      },
    );

    this.on(
      this.contracts.p2pStaker,
      'RewardWithdrawn',
      (account: string, amount: BigNumber, event: Event) => {
        this.onRewardWithdrawn(account, amount, event);
      },
    );

    this.on(
      this.contracts.p2pStaker,
      'Recovered',
      (token: string, amount: BigNumber, event: Event) => {
        this.onRecovered(token, amount, event);
      },
    );
  }

  /**
   * An account added a stake
   * @param account The address of the account
   * @param amount The amount staked
   * @param event The event object
   */
  async onStaked(account: string, amount: BigNumber, event: Event) {}

  /**
   * An account added a vested stake
   * @param account The address of the account
   * @param amount The amount staked
   * @param event The event object
   */
  async onVestStaked(account: string, amount: BigNumber, event: Event) {}

  /**
   * An account withdrew some stake
   * @param account The address of the account
   * @param amount The amount withdrawn
   * @param event The event object
   */
  async onStakeWithdrawn(account: string, amount: BigNumber, event: Event) {}

  /**
   * An account withdrew some reward
   * @param account The address of the account
   * @param amount The amount of reward withdrawn
   * @param event The event object
   */
  async onRewardWithdrawn(account: string, amount: BigNumber, event: Event) {}

  /**
   * An erroneously sent token was recovered
   * @param token The address of the token
   * @param amount The amount recovered
   * @param event The event object
   */
  async onRecovered(token: string, amount: BigNumber, event: Event) {}
}
