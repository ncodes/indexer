import { BigNumber, Event } from 'ethers';
import { Handler } from './handler';

export class FeeSharerHandler extends Handler {
  constructor(private contracts: KnownContracts) {
    super();
  }

  /**
   * Listen for events
   */
  listen() {
    this.on(
      this.contracts.feeSharer,
      'RewardAdded',
      (token: string, amount: BigNumber, event: Event) => {
        this.onRewardAdded(token, amount, event);
      },
    );

    this.on(
      this.contracts.feeSharer,
      'RewardWithdrawn',
      (token: string, account: string, amount: BigNumber, event: Event) => {
        this.onRewardWithdrawn(token, account, amount, event);
      },
    );

    this.on(
      this.contracts.feeSharer,
      'Recovered',
      (token: string, amount: BigNumber, event: Event) => {
        this.onRecovered(token, amount, event);
      },
    );
  }

  /**
   * A token has been transferred into the contract for sharing
   * @param token The address of the token
   * @param amount The amount transferred
   * @param event The event object
   */
  async onRewardAdded(token: string, amount: BigNumber, event: Event) {}

  /**
   * An account withdrew some reward
   * @param token The token address
   * @param account The address of the account
   * @param amount The amount of reward withdrawn
   * @param event The event object
   */
  async onRewardWithdrawn(
    token: string,
    account: string,
    amount: BigNumber,
    event: Event,
  ) {}

  /**
   * An erroneously sent token was recovered
   * @param token The address of the token
   * @param amount The amount recovered
   * @param event The event object
   */
  async onRecovered(token: string, amount: BigNumber, event: Event) {}
}
