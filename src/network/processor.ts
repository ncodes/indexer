import { Logger } from '@nestjs/common';
import * as defer from 'defer-promise';
import * as LRUCache from 'lru-cache';
import * as sortArray from 'sort-array';
import { isDev, isEqualStr, isTest, shortenAddr } from '../common/common';
import ChainEvent from '../models/chain_events';
import { ContractCallEvent } from './common';
import { Handler } from './handler';

export interface UnprocessedEvent {
  event: ContractCallEvent;
  block: number;
  txIndex: number;
  eventIndex: number;
  contract: string;
  promise?: any;
}

/**
 * Processor processes events from the queue
 */
export default class Processor {
  logger = new Logger(Processor.name);
  private seen = new LRUCache({ max: 500 });
  private processing = false;

  // The collection of unprocessed events
  unprocessed: UnprocessedEvent[] = [];

  /**
   * Initialize the sequencer
   * @param network The network name
   * @param handlers The event handlers
   */
  constructor(private network: string, private handlers: Handler[] = []) {
    if (!isTest()) this.processEvents();
  }

  /**
   * Add a handler and start synchronizing it
   * @param handlers one or more handlers
   */
  async add(...handlers: Handler[]) {
    for (const h of handlers) {
      this.handlers.push(h);
      h.listen();
    }
  }

  /**
   * Get a handler by contract address
   * @param address The contract address
   */
  getHandler(address: string) {
    for (const item of this.handlers) {
      if (isEqualStr(item.getContract().target as string, address)) return item;
    }
  }

  makeEventId(event: UnprocessedEvent) {
    return `${event.block}-${event.txIndex}-${event.eventIndex}`;
  }

  /**
   * Add an event to the unprocessed queue
   * @param e The target event
   */
  addEvent(e: UnprocessedEvent): Promise<any> {
    const eventId = this.makeEventId(e);
    if (this.seen.has(eventId)) {
      this.logger.debug(`(Event: ${e.event.event}, Contract: ${shortenAddr(e.contract)}): Previously seen event`);
      return;
    }
    this.seen.set(eventId, true);

    // Add a promise to the event and push it to the queue
    const deferred = defer();
    e.promise = deferred;
    this.unprocessed.push(e);

    // Sort the queue to ensure correct order
    sortArray(this.unprocessed, {
      by: ['block', 'txIndex', 'eventIndex'],
      order: 'asc',
    });

    return deferred.promise;
  }

  /**
   * Emit an event that has not previously been emitted
   * @param e The target event to be emitted
   */
  async emit(e: UnprocessedEvent) {
    const txn = await ChainEvent.startTransaction();
    await txn.raw('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
    const args = [...e.event.args.slice(0, e.event.args.length), e.event, txn];
    const removed = e.event.removed;

    try {
      await ChainEvent.bindTransaction(txn).create({
        network: this.network,
        signature: e.event.eventSignature,
        blockNumber: e.block,
        txIndex: e.txIndex,
        logIndex: e.eventIndex,
        removed: !!removed,
        txHash: e.event.transactionHash,
      });

      if (removed) {
        e.event.event = `${e.event.event}Reverted`;
      }

      this.logger.debug(`(Event:${e.event.event}, Contract: ${shortenAddr(e.contract)}): processing an event...`);
      await this.getHandler(e.contract).emitAsync(e.event.event, ...args);
      await txn.commit();

      this.logger.debug(`(Event:${e.event.event}, Contract: ${shortenAddr(e.contract)}): finished processing an event`);
    } catch (error) {
      await txn.rollback();

      if (error.message.indexOf('duplicate key') !== -1 && error.message.indexOf(ChainEvent.tableName) !== -1) {
        this.logger.debug(`(Event: ${e.event.event}, Contract: ${shortenAddr(e.contract)}): Previously seen event`);
        return;
      }

      // Remove the event from the seen cache because it will be retried by the syncer
      this.seen.del(this.makeEventId(e));

      this.logger.error(
        `Error (Event: ${e.event.event}, Contract: ${shortenAddr(e.contract)}): ${error.message}`,
        error,
      );

      return Promise.reject(error);
    }
  }

  /**
   * Process events from the queue
   * @private
   */
  private processEvents() {
    setInterval(
      async () => {
        if (this.processing) return;
        if (this.unprocessed.length === 0) return;
        this.processing = true;
        const evt = this.unprocessed.splice(0, 1)[0];
        try {
          await this.emit(evt);
          evt.promise.resolve();
        } catch (e) {
          evt.promise.reject(e);
        } finally {
          this.processing = false;
        }
      },
      isDev() ? 100 : 1000,
    );
  }
}
