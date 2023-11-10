import { Logger } from '@nestjs/common';
import * as sortArray from 'sort-array';
import { isDevMode, isEqualStr, isTestMode, shortenAddr } from '../common/common';
import ChainEvent from '../models/chain_events';
import { Handler } from './handler';
import { UnprocessedEvent } from './watcher';

/**
 * Processor processes events from the queue
 */
export default class Processor {
  logger = new Logger(Processor.name);
  private processing = false;

  // The collection of unprocessed events
  unprocessed: UnprocessedEvent[] = [];

  /**
   * Initialize the sequencer
   * @param network The network name
   * @param handlers The event handlers
   */
  constructor(private network: string, private handlers: Handler[] = []) {
    if (!isTestMode()) this.processEvents();
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
      if (isEqualStr(item.getContract().address, address)) return item;
    }
  }

  /**
   * Add an event to the unprocessed collection
   * @param event The target event
   */
  addEvent(event: UnprocessedEvent) {
    this.unprocessed.push(event);
    sortArray(this.unprocessed, {
      by: ['block', 'txIndex', 'eventIndex'],
      order: 'asc',
    });
  }

  /**
   * Emit an event that has not previously been emitted
   * @param e The target event to be emitted
   */
  async emit(e: UnprocessedEvent) {
    const txn = await ChainEvent.startTransaction();
    const args = [...e.event.args.slice(0, e.event.args.length), e.event, txn];

    try {
      await ChainEvent.bindTransaction(txn).create({
        network: this.network,
        signature: e.event.eventSignature,
        blockNumber: e.event.blockNumber,
        txIndex: e.event.transactionIndex,
        logIndex: e.event.logIndex,
      });

      this.logger.debug(`(Event:${e.event.event}, Contract: ${shortenAddr(e.contract)}): processing an event...`);
      await this.getHandler(e.contract).emitAsync(e.event.event, ...args);
      await txn.commit();

      this.logger.debug(`(Event:${e.event.event}, Contract: ${shortenAddr(e.contract)}): finished processing an event`);
    } catch (error) {
      await txn.rollback();

      if (error.message.indexOf('duplicate key') !== -1 && error.message.indexOf(ChainEvent.tableName) !== -1) {
        this.logger.debug(`(Event: ${e.event.event}, Contract: ${shortenAddr(e.contract)}): Previously seen event`);
        return Promise.resolve();
      }

      this.logger.error(`Error (Event: ${e.event.event}, Contract: ${shortenAddr(e.contract)}): ${error.message}`);
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
      isDevMode() ? 100 : 1000,
    );
  }
}
