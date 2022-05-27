import { BigNumber, ethers, Event } from 'ethers';
import { Handler } from './handler';

export class LPStakerHandler extends Handler {
  constructor(private contracts: KnownContracts) {
    super();
  }

  /**
   * Listen for events
   */
  listen() {
    this.on(
      this.contracts.lpStaker,
      'RewardWithdrawn',
      (account: string, amount: BigNumber, event: Event) => {
        this.onRewardWithdrawn(account, amount, event);
      },
    );

    this.on(
      this.contracts.lpStaker,
      'RewardAdded',
      (amount: BigNumber, event: Event) => {
        this.onRewardAdded(amount, event);
      },
    );

    this.on(
      this.contracts.lpStaker,
      'Locked',
      (account: string, amount: BigNumber, event: Event) => {
        this.onLocked(account, amount, event);
      },
    );

    this.on(
      this.contracts.lpStaker,
      'Unlocked',
      (account: string, amount: BigNumber, event: Event) => {
        this.onUnlocked(account, amount, event);
      },
    );

    this.on(
      this.contracts.lpStaker,
      'Recovered',
      (token: string, amount: BigNumber, event: Event) => {
        this.onRecovered(token, amount, event);
      },
    );
  }

  /**
   * An account withdrew some reward
   * @param account The address of the account
   * @param amount The amount that was withdrawn
   * @param event The event object
   */
  async onRewardWithdrawn(
    account: string,
    amount: BigNumber,
    event: ethers.Event,
  ) {}

  /**
   * Reward tokens were transferred to the contract
   * @param amount The amount transferred
   * @param event The event object
   */
  async onRewardAdded(amount: BigNumber, event: ethers.Event) {}

  /**
   * An account locked some LP tokens
   * @param account The address of the account
   * @param amount The amount of LP tokens
   * @param event The event object
   */
  async onLocked(account: string, amount: BigNumber, event: ethers.Event) {}

  /**
   * An account unlocked some LP tokens
   * @param account The address of the account
   * @param amount The amount of LP tokens unlocked
   * @param event The event object
   */
  async onUnlocked(account: string, amount: BigNumber, event: ethers.Event) {}

  /**
   * An erroneously sent token was recovered
   * @param token The address of the token
   * @param amount The amount recovered
   * @param event The event object
   */
  async onRecovered(token: string, amount: BigNumber, event: ethers.Event) {}
}
