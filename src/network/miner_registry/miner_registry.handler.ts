import { Provider } from 'ethers';
import * as moment from 'moment';
import { Transaction } from 'objection';
import Meta from '../../models/meta';
import Miner from '../../models/miner';
import MinerReward from '../../models/miner_reward';
import MinerSlash from '../../models/miner_slash';
import { ContractCallEvent, getBlockTime, toNumber } from '../common';
import { Handler } from '../handler';

export const MinerRewardOpName = {
  0: 'draftReward',
  1: 'undraftReward',
  2: 'executeReward',
  3: 'cancelReward',
} as const;

export class MinerRegistryHandler extends Handler {
  constructor(private provider: Provider, public network: string, private contracts: JointContracts) {
    super(MinerRegistryHandler.name, null, network, contracts.minerRegistry);
  }

  /**
   * Listen for events
   */
  listen() {
    this.on('UpdatedOpReward', async (op: bigint, amount: bigint, event: Event, txn?: Transaction) => {
      return this.onParameterUpdate(MinerRewardOpName[toNumber(op)], amount.toString(), event, txn);
    });

    this.on('UpdatedOpsReward', async (ops: bigint[], amounts: bigint[], event: Event, txn?: Transaction) => {
      for (let i = 0; i < ops.length; i++) {
        await this.onParameterUpdate(MinerRewardOpName[toNumber(ops[i])], amounts[i].toString(), event, txn);
      }
    });

    this.on('UpdatedMinerBond', async (minerBond: bigint, event: Event, txn?: Transaction) => {
      return this.onParameterUpdate('minerBond', minerBond.toString(), event, txn);
    });

    this.on('UpdatedDurations', async (matureDur: bigint, cancelDur: bigint, event: Event, txn?: Transaction) => {
      await this.onParameterUpdate('minerMatureDur', matureDur.toString(), event, txn);
      await this.onParameterUpdate('minerCancelDur', cancelDur.toString(), event, txn);
    });

    this.on('Registered', async (address: string, bond: bigint, event: ContractCallEvent, txn?: Transaction) => {
      return this.onRegistered(address, bond, event, txn);
    });

    this.on('Cancelled', async (address: string, cancelDur: bigint, event: ContractCallEvent, txn?: Transaction) => {
      return this.onCancelled(address, cancelDur, event, txn);
    });

    this.on('Drained', async (address: string, amount: bigint, event: ContractCallEvent, txn?: Transaction) => {
      return this.onDrained(address, amount, event, txn);
    });

    this.on('Blocked', async (address: string, blocked: boolean, event: ContractCallEvent, txn?: Transaction) => {
      return this.onBlocked(address, blocked, event, txn);
    });

    this.on('Slashed', async (address: string, amount: bigint, event: ContractCallEvent, txn?: Transaction) => {
      return this.onSlashed(address, amount, event, txn);
    });

    this.on(
      'AddedReward',
      async (address: string, op: bigint, amount: bigint, event: ContractCallEvent, txn?: Transaction) => {
        return this.onRewardAdded(address, op, amount, event, txn);
      },
    );
  }

  /**
   * Updated a parameter
   * @param param The parameter name
   * @param value The updated value
   * @param _event The event object
   * @param txn The transaction object
   */
  async onParameterUpdate(param: keyof ContractsParams, value: string, _event: Event, txn?: Transaction) {
    await Meta.updateContractsParams(this.network, txn, (params) => (params[param] = value));
  }

  /**
   * Register a miner
   * @param address The miner address
   * @param bond The miner bond
   * @param event The event object
   * @param txn The transaction object
   */
  async onRegistered(address: string, bond: bigint, event: ContractCallEvent, txn?: Transaction) {
    const blockTime = await getBlockTime(event);
    const matureTime = blockTime + parseInt(await this.getParam('minerMatureDur'));

    const existing = await Miner.getByNetworkAndAddress(this.network, address, txn);
    if (existing) {
      await Miner.updateById(
        existing.id,
        {
          bond: bond.toString(),
          drained: false,
          cancelling: false,
          cancelledAt: null,
          maturedAt: moment.unix(matureTime).toISOString(),
        },
        txn,
      );
    } else {
      await Miner.create(
        {
          network: this.network,
          address,
          bond: bond.toString(),
          maturedAt: moment.unix(matureTime).toISOString(),
        },
        txn,
      );
    }
  }

  /**
   * Register a miner
   * @param address The miner address
   * @param cancelDur The duration until the miner registration is cancelled
   * @param event The event object
   * @param txn The transaction object
   */
  async onCancelled(address: string, cancelDur: bigint, event: ContractCallEvent, txn?: Transaction) {
    const blockTime = await getBlockTime(event);
    const cancelTime = blockTime + toNumber(cancelDur);
    await Miner.updateByNetworkAndAddress(
      this.network,
      address,
      { cancelling: true, cancelledAt: moment.unix(cancelTime).toISOString() },
      txn,
    );
  }

  /**
   * Miner bond is drained
   * @param address The miner address
   * @param amount The amount drained
   * @param event The event object
   * @param txn The transaction object
   */
  async onDrained(address: string, amount: bigint, _event: ContractCallEvent, txn?: Transaction) {
    await Miner.updateByNetworkAndAddress(
      this.network,
      address,
      {
        bond: '0',
        drained: true,
      },
      txn,
    );
  }

  /**
   * Miner block status is updated
   * @param address The miner address
   * @param blocked Whether the miner is blocked or not
   * @param event The event object
   * @param txn The transaction object
   */
  async onBlocked(address: string, blocked: boolean, _event: ContractCallEvent, txn?: Transaction) {
    await Miner.updateByNetworkAndAddress(this.network, address, { blocked }, txn);
  }

  /**
   * Miner block status is updated
   * @param address The miner address
   * @param amount The amount slashed
   * @param event The event object
   * @param txn The transaction object
   */
  async onSlashed(address: string, amount: bigint, _event: ContractCallEvent, txn?: Transaction) {
    await MinerSlash.create(
      {
        network: this.network,
        address,
        amount: amount.toString(),
      },
      txn,
    );
  }

  /**
   * Reward was added
   * @param address The address of the miner
   * @param op The operation
   * @param amount The amount of the reward
   * @param event The event object
   * @param txn The transaction object
   */
  async onRewardAdded(address: string, op: bigint, amount: bigint, _event: ContractCallEvent, _txn?: Transaction) {
    await MinerReward.create({
      network: this.network,
      address,
      operation: MinerRewardOpName[toNumber(op)],
      amount: amount.toString(),
    });
  }
}
