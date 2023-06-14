import { BigNumber, ethers, Event, providers } from 'ethers';
import { Handler } from '../handler';

export class LPPoolHandler extends Handler {
  constructor(private provider: providers.JsonRpcProvider, public network: string, private contracts: JointContracts) {
    super(LPPoolHandler.name, null, network, contracts.lpPool);
  }

  /**
   * Listen for events
   */
  listen() {
    this.on('RewardWithdrawn', async (account: string, amount: BigNumber, event: Event) => {
      return this.onRewardWithdrawn(account, amount, event);
    });

    this.on('RewardAdded', async (amount: BigNumber, event: Event) => {
      return this.onRewardAdded(amount, event);
    });

    this.on('Locked', async (account: string, amount: BigNumber, event: Event) => {
      return this.onLocked(account, amount, event);
    });

    this.on('Unlocked', async (account: string, amount: BigNumber, event: Event) => {
      return this.onUnlocked(account, amount, event);
    });

    this.on('Recovered', async (token: string, amount: BigNumber, event: Event) => {
      return this.onRecovered(token, amount, event);
    });
  }

  /**
   * An account withdrew some reward
   * @param account The address of the account
   * @param amount The amount that was withdrawn
   * @param event The event object
   */
  async onRewardWithdrawn(account: string, amount: BigNumber, event: ethers.Event) {}

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
