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
   * @param _account The address of the account
   * @param _amount The amount that was withdrawn
   * @param _event The event object
   */
  async onRewardWithdrawn(_account: string, _amount: BigNumber, _event: ethers.Event) {
    // TODO: Implement
  }

  /**
   * Reward tokens were transferred to the contract
   * @param _amount The amount transferred
   * @param _event The event object
   */
  async onRewardAdded(_amount: BigNumber, _event: ethers.Event) {
    // TODO: Implement
  }

  /**
   * An account locked some LP tokens
   * @param _account The address of the account
   * @param _amount The amount of LP tokens
   * @param _event The event object
   */
  async onLocked(_account: string, _amount: BigNumber, _event: ethers.Event) {
    // TODO: Implement
  }

  /**
   * An account unlocked some LP tokens
   * @param _account The address of the account
   * @param _amount The amount of LP tokens unlocked
   * @param _event The event object
   */
  async onUnlocked(_account: string, _amount: BigNumber, _event: ethers.Event) {
    // TODO: Implement
  }

  /**
   * An erroneously sent token was recovered
   * @param _token The address of the token
   * @param _amount The amount recovered
   * @param _event The event object
   */
  async onRecovered(_token: string, _amount: BigNumber, _event: ethers.Event) {
    // TODO: Implement
  }
}
