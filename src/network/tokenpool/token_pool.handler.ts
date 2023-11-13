import { BigNumber, Event, providers } from 'ethers';
import { Handler } from '../handler';

export class TokenPoolHandler extends Handler {
  constructor(private provider: providers.JsonRpcProvider, public network: string, private contracts: JointContracts) {
    super(TokenPoolHandler.name, null, network, contracts.tokenPool);
  }

  /**
   * Listen for events
   */
  listen() {
    this.on('Staked', async (account: string, amount: BigNumber, event: Event) => {
      return this.onStaked(account, amount, event);
    });

    this.on('VestStaked', async (account: string, amount: BigNumber, event: Event) => {
      return this.onVestStaked(account, amount, event);
    });

    this.on('StakeWithdrawn', async (account: string, amount: BigNumber, event: Event) => {
      return this.onStakeWithdrawn(account, amount, event);
    });

    this.on('RewardWithdrawn', async (account: string, amount: BigNumber, event: Event) => {
      return this.onRewardWithdrawn(account, amount, event);
    });

    this.on('Recovered', async (token: string, amount: BigNumber, event: Event) => {
      return this.onRecovered(token, amount, event);
    });
  }

  /**
   * An account added a stake
   * @param _account The address of the account
   * @param _amount The amount staked
   * @param event The event object
   */
  async onStaked(_account: string, _amount: BigNumber, _event: Event) {
    // TODO: Implement
  }

  /**
   * An account added a vested stake
   * @param account The address of the account
   * @param amount The amount staked
   * @param event The event object
   */
  async onVestStaked(_account: string, _amount: BigNumber, _event: Event) {
    // TODO: Implement
  }

  /**
   * An account withdrew some stake
   * @param account The address of the account
   * @param amount The amount withdrawn
   * @param event The event object
   */
  async onStakeWithdrawn(_account: string, _amount: BigNumber, _event: Event) {
    // TODO: Implement
  }

  /**
   * An account withdrew some reward
   * @param account The address of the account
   * @param amount The amount of reward withdrawn
   * @param event The event object
   */
  async onRewardWithdrawn(_account: string, _amount: BigNumber, _event: Event) {
    // TODO: Implement
  }

  /**
   * An erroneously sent token was recovered
   * @param token The address of the token
   * @param amount The amount recovered
   * @param event The event object
   */
  async onRecovered(_token: string, _amount: BigNumber, _event: Event) {
    // TODO: Implement
  }
}
