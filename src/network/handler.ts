import { Logger } from '@nestjs/common';
import { Contract, ContractInterface, Event as Evt, Signer } from 'ethers';
import { promise, queue } from 'fastq';
import Event from '../models/events';
import { Provider } from '@ethersproject/abstract-provider';

type Task = {
  args: any[];
  f: (...args: any[]) => void;
};

/**
 * Processes an event
 * @param task The task argument
 * @returns
 */
export async function task(task: Task): Promise<void> {
  const logger = new Logger(Handler.name);
  const txn = await Event.startTransaction();
  try {
    const event: Evt = task.args[task.args.length - 1];
    await Event.bindTransaction(txn).create({
      network: this.network,
      signature: event.eventSignature,
      blockNumber: event.blockNumber,
      txIndex: event.transactionIndex,
      logIndex: event.logIndex,
    });
    await task.f(...task.args, txn);
    await txn.commit();
  } catch (error) {
    await txn.rollback();
    if (error.message.indexOf('duplicate key')) return Promise.resolve();
    logger.error(`Event Execution Error: ${error.message}`);
    return Promise.reject(error);
  }
}

export class Handler {
  logger = new Logger(Handler.name);
  private eventQueue: { [event: string]: queue<Task> } = {};

  /**
   * Initialize the handler
   * @param network The network name
   */
  constructor(public network: string) {}

  /**
   * Create an ethers.js Contract object
   * @param addressOrName
   * @param contractInterface
   * @param signerOrProvider
   */
  newContract(
    addressOrName: string,
    contractInterface: ContractInterface,
    signerOrProvider: Signer | Provider,
  ) {
    return new Contract(addressOrName, contractInterface, signerOrProvider);
  }

  /**
   * Bind listeners to contract event
   * @param contract The contract object
   * @param event The target event
   * @param f The listener to be called
   */
  on(contract: Contract, event: string, f: (...args: any[]) => void) {
    // Create a queue for the event if not already created
    if (!this.eventQueue[event]) {
      this.eventQueue[event] = promise(this, task, 1);
    }

    // Push new event to event queue
    contract.on(event, async (...args: any[]) => {
      this.logger.debug(`Event:${event}: received and queued`);
      await this.eventQueue[event].push({ args, f });
    });
  }
}
