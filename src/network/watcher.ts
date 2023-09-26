import { Logger } from '@nestjs/common';
import { ethers, providers } from 'ethers';
import Meta from '../models/meta';
import { Handler } from './handler';
import * as defer from 'defer-promise';
import Processor from './processor';
import { isDevMode } from '../common/common';
import { NotifierService } from '../jobs/mailer/NotifierService';

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
  private interval: NodeJS.Timeout;
  handlers: Handler[] = [];
  private isSyncing = false;

  /**
   * Initialize the watcher
   * @param network The network name
   * @param provider The network provider
   * @param processor The processor object
   * @param notifierService The notification service
   */
  constructor(public network: string, private provider: providers.JsonRpcProvider, private processor: Processor) {}

  /**
   * Add handlers and start synchronizing them
   * @param handlers one or more handlers
   */
  async add(...handlers: Handler[]) {
    this.handlers = handlers;
    this.interval = this.sync();
  }

  /**
   * Make last sync key
   * @private
   */
  private makeSyncKey() {
    return `sync_height:${this.network}`;
  }

  getEventFromLog(log: ethers.providers.Log, iface: ethers.utils.Interface) {
    const parsed = iface.parseLog(log);
    return {
      event: parsed.name,
      args: parsed.args,
      blockNumber: log.blockNumber,
      logIndex: log.logIndex,
      transactionIndex: log.transactionIndex,
      transactionHash: log.transactionHash,
      address: log.address,
      eventSignature: parsed.signature,
      getBlock: () => this.provider.getBlock(log.blockNumber),
      getTransaction: () => this.provider.getTransaction(log.transactionHash),
    } as ethers.Event;
  }

  /**
   * Watch for event on new block
   */
  watchBlock() {
    const listener = async (curBlock: number) => {
      try {
        const key = this.makeSyncKey();
        let meta = await Meta.get(key);
        if (!meta) {
          meta = new Meta({ value: process.env[`LAUNCH_HEIGHT`] || '1' });
        }

        if (parseInt(meta.value) >= curBlock) return;

        this.logger.log(`New block: ${curBlock}`);

        // Query events for all contracts within the start and end block height
        const events: ethers.Event[] = [];
        for (let i = 0; i < this.handlers.length; i++) {
          const addr = this.handlers[i].getContract().address;
          events.push(
            ...(await this.provider.getLogs({ address: addr, fromBlock: parseInt(meta.value), toBlock: curBlock })).map(
              (log) => {
                return this.getEventFromLog(log, this.handlers[i].getContract().interface);
              },
            ),
          );
        }

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
              contract: e.address,
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
        this.interval = this.sync();
      }
    };
    this.provider.on('block', listener);
  }

  sync() {
    return setInterval(
      async () => {
        if (this.isSyncing) return;
        this.isSyncing = true;
        try {
          // Get last synced block height
          const key = this.makeSyncKey();
          let meta = await Meta.get(key);
          if (!meta) {
            meta = new Meta({ value: process.env[`LAUNCH_HEIGHT`] || '1' });
          }

          // Ensure we are not fully synchronized yet.
          // If we are, stop watching on interval. Instead, watch on new block.
          const curBlock = await this.provider.getBlockNumber();
          if (parseInt(meta.value) + 1 > curBlock) {
            this.watchBlock();
            clearInterval(this.interval);
            return;
          }

          // Determine the start and end block height
          let endBlock = process.env.WATCH_RANGE
            ? parseInt(process.env.WATCH_RANGE) + parseInt(meta.value)
            : parseInt(meta.value) + 1;
          endBlock = endBlock > curBlock ? curBlock : endBlock;
          const startBlock = parseInt(meta.value) + 1;
          this.logger.log(`Syncing blocks between ${startBlock} and ${endBlock} (Current Head: ${curBlock})`);

          // Query events for all contracts within the start and end block height
          const events: ethers.Event[] = [];
          for (let i = 0; i < this.handlers.length; i++) {
            const addr = this.handlers[i].getContract().address;
            events.push(
              ...(await this.provider.getLogs({ address: addr, fromBlock: startBlock, toBlock: endBlock })).map(
                (log) => {
                  return this.getEventFromLog(log, this.handlers[i].getContract().interface);
                },
              ),
            );
          }

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
                contract: e.address,
                promise: deferred,
              });
            }
            await Promise.all(promises);
          }

          // Update the last sync height
          await Meta.update(key, endBlock.toString());
        } catch (e) {
          this.logger.error(`watch error: ` + e.message, e.stack);
        } finally {
          this.isSyncing = false;
        }
      },
      isDevMode() ? 100 : 1000,
    );
  }
}
