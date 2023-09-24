import { Logger } from '@nestjs/common';
import { Contract, ethers, providers } from 'ethers';
import Meta from '../models/meta';
import { Handler } from './handler';
import * as defer from 'defer-promise';
import Processor from './processor';
import { isDevMode } from '../common/common';

export interface UnprocessedEvent {
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
  private isSyncing: { [k: string]: boolean } = {};

  /**
   * Initialize the watcher
   * @param network The network name
   * @param provider The network provider
   * @param processor The processor object
   */
  constructor(public network: string, private provider: providers.JsonRpcProvider, private processor: Processor) {}

  /**
   * Add a handler and start synchronizing it
   * @param handlers one or more handlers
   */
  async add(...handlers: Handler[]) {
    for (const h of handlers) {
      this.handlers.push(h);
      this.intervals[h.getContract().address] = this.sync(h.name, h.getContract());
    }
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
   * Watch for event on new block
   * @param handlerName The handler name
   * @param contract The target contract
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
            this.processor.addEvent({
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
        this.intervals[contract.address] = this.sync(handlerName, contract);
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
    return setInterval(
      async () => {
        if (this.isSyncing[contract.address]) return;
        this.isSyncing[contract.address] = true;
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
              this.processor.addEvent({
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
        } finally {
          this.isSyncing[contract.address] = false;
        }
      },
      isDevMode() ? 100 : 1000,
    );
  }
}
