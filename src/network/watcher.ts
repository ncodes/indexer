import { Logger } from '@nestjs/common';
import { Contract, ethers, providers } from 'ethers';
import Meta from '../models/meta';
import * as sortArray from 'sort-array';
import { Handler } from './handler';
import { isDevMode, isTestMode, shortenAddr } from '../common/common';
import ChainEvent from '../models/chain_events';
import * as defer from 'defer-promise';

interface Evt {
  event: ethers.Event;
  block: number;
  txIndex: number;
  eventIndex: number;
  contract: string;
  promise: any;
}

export class Watcher {
  logger = new Logger(Watcher.name);
  private intervals: { [key: string]: NodeJS.Timeout } = {};
  handlers: Handler[] = [];
  events: Evt[] = [];

  /**
   * Initialize the watcher
   * @param network The network name
   * @param provider The network provider
   */
  constructor(public network: string, private provider: providers.JsonRpcProvider) {
    if (!isTestMode()) this.processEvents();
  }

  /**
   * Add a handler and start synchronizing it
   * @param handlers one or more handlers
   */
  async add(...handlers: Handler[]) {
    for (const h of handlers) {
      this.handlers.push(h);
      this.intervals[h.getContract().address] = this.sync(h.name, h.getContract());
      h.listen();
    }
    return Promise.resolve();
  }

  /**
   * Make last sync key
   * @param address The contract address
   * @private
   */
  private makeSyncKey(address: string) {
    return `lastSyncedHeight_${this.network}_${address}`;
  }

  /**
   * Get a handler by contract address
   * @param address The contract address
   */
  getHandler(address: string) {
    for (const item of this.handlers) {
      if (item.getContract().address === address) return item;
    }
  }

  /**
   * Watch for event on new block
   */
  watchBlock(handlerName: string, contract: Contract) {
    const listener = async (curBlock: number) => {
      try {
        const key = `lastSyncedHeight_${this.network}_${contract.address}`;
        let meta = await Meta.get(key);
        if (!meta) {
          meta = new Meta({
            value: process.env[`LAUNCH_HEIGHT`] || '1',
          });
        }

        if (parseInt(meta.value) >= curBlock) return;

        // Query and execute events
        const events = await contract.queryFilter({}, parseInt(meta.value), curBlock);
        if (events.length) {
          const promises = [];
          for (const e of events) {
            const deferred = defer();
            promises.push(deferred.promise);
            this.pushEvent({
              event: e,
              block: e.blockNumber,
              txIndex: e.transactionIndex,
              eventIndex: e.logIndex,
              contract: contract.address,
              promise: deferred,
            });
          }
          await Promise.all(promises);
        }

        // Update the last sync height
        await Meta.update(key, curBlock.toString());
      } catch (e) {
        this.logger.error('WatchBlock(): ', e);
        this.provider.off('block', listener);
        this.sync(handlerName, contract);
      }
    };
    this.provider.on('block', listener);
  }

  /**
   * Synchronize events for the given contract
   * @param handlerName The handler name
   * @param contract The target contract
   */
  sync(handlerName: string, contract: Contract) {
    return setInterval(async () => {
      try {
        // Get last synced block height
        const key = this.makeSyncKey(contract.address);
        let meta = await Meta.get(key);
        if (!meta) {
          meta = new Meta({
            value: process.env[`LAUNCH_HEIGHT`] || '1',
          });
        }

        // Ensure we are not fully synchronized yet.
        // If we are, stop watching on interval. Instead, watch on new block.
        const curBlock = await contract.provider.getBlockNumber();
        if (parseInt(meta.value) + 1 > curBlock) {
          this.watchBlock(handlerName, contract);
          clearInterval(this.intervals[contract.address]);
          return;
        }

        // Query events
        let endBlock = process.env.WATCH_RANGE
          ? parseInt(process.env.WATCH_RANGE) + parseInt(meta.value)
          : parseInt(meta.value) + 1;
        endBlock = endBlock > curBlock ? curBlock : endBlock;
        const startBlock = parseInt(meta.value) + 1;
        const events = await contract.queryFilter({}, startBlock, endBlock);

        if (events.length) {
          const promises = [];
          for (const e of events) {
            const deferred = defer();
            promises.push(deferred.promise);
            this.pushEvent({
              event: e,
              block: e.blockNumber,
              txIndex: e.transactionIndex,
              eventIndex: e.logIndex,
              contract: contract.address,
              promise: deferred,
            });
          }
          await Promise.all(promises);
        }

        // Update the last sync height
        await Meta.update(key, endBlock.toString());
      } catch (e) {
        this.logger.error(`watch(${handlerName}): ` + e.message, e.stack);
      }
    }, 1000);
  }

  /**
   * Push events to the list and sort it
   * @param e The new event
   * @private
   */
  private pushEvent(e: Evt) {
    this.events.push(e);
    sortArray(this.events, {
      by: ['block', 'txIndex', 'eventIndex'],
      order: 'asc',
    });
  }

  /**
   * Emit an event that has not previously been emitted
   * @param e The target event to be emitted
   */
  async emit(e: Evt) {
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
      this.logger.debug(`Event:${e.event.event}: processing an event...`);
      await this.getHandler(e.contract).emitAsync(e.event.event, ...args);
      await txn.commit();
      this.logger.debug(`Event:${e.event.event}: finished processing an event`);
    } catch (error) {
      await txn.rollback();
      if (error.message.indexOf('duplicate key') !== -1) return Promise.resolve();
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
        if (this.events.length === 0) return;
        const evt = this.events.splice(0, 1)[0];
        try {
          await this.emit(evt);
          evt.promise.resolve();
        } catch (e) {
          evt.promise.reject(e);
        }
      },
      isDevMode() ? 100 : 1000,
    );
  }
}
