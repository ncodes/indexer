import { BigNumber, Event, providers } from 'ethers';
import { Handler } from '../handler';

export class FeePoolHandler extends Handler {
  constructor(private provider: providers.JsonRpcProvider, public network: string, private contracts: JointContracts) {
    super(FeePoolHandler.name, null, network, contracts.feePool);
  }

  /**
   * Listen for events
   */
  listen() {
    this.on('RewardAdded', async (token: string, amount: BigNumber, event: Event) => {
      return this.onRewardAdded(token, amount, event);
    });

    this.on('RewardWithdrawn', async (token: string, account: string, amount: BigNumber, event: Event) => {
      return this.onRewardWithdrawn(token, account, amount, event);
    });

    this.on('Recovered', async (token: string, amount: BigNumber, event: Event) => {
      return this.onRecovered(token, amount, event);
    });
  }

  /**
   * A token has been transferred into the contract for sharing
   * @param _token The address of the token
   * @param _amount The amount transferred
   * @param _event The event object
   */
  async onRewardAdded(_token: string, _amount: BigNumber, _event: Event) {
    //
  }

  /**
   * An account withdrew some reward
   * @param _token The token address
   * @param _account The address of the account
   * @param _amount The amount of reward withdrawn
   * @param _event The event object
   */
  async onRewardWithdrawn(_token: string, _account: string, _amount: BigNumber, _event: Event) {
    //
  }

  /**
   * An erroneously sent token was recovered
   * @param _token The address of the token
   * @param _amount The amount recovered
   * @param _event The event object
   */
  async onRecovered(_token: string, _amount: BigNumber, _event: Event) {
    //
  }
}
