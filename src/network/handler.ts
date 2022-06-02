import { Logger } from '@nestjs/common';
import { Contract, Event as Evt } from 'ethers';
import { promise, queue } from 'fastq';
import { transaction } from 'objection';
import Event from '../models/events';

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
  try {
    await transaction(Event, async (Event) => {
      const event: Evt = task.args[task.args.length - 1];
      await Event.create({
        network: this.network,
        signature: event.eventSignature,
        blockNumber: event.blockNumber,
        txIndex: event.transactionIndex,
        logIndex: event.logIndex,
      });
      await task.f(...task.args);
    });
  } catch (error) {
    if (error.message.indexOf('duplicate key')) return Promise.resolve();
    logger.error(`Event Execution Error: ${error.message}`);
    return Promise.reject(error);
  }
}

export class Handler {
  private eventQueue: { [event: string]: queue<Task> } = {};

  /**
   * Initialize the handler
   * @param network The network name
   */
  constructor(public network: string) {}

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
      await this.eventQueue[event].push({ args, f });
    });
  }
}
