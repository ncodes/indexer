import { Logger } from '@nestjs/common';
import * as defer from 'defer-promise';
import { BigNumber, constants, ethers, providers } from 'ethers';
import { isDev, isEqualStr } from '../common/common';
import Meta from '../models/meta';
import { Handler } from './handler';
import Processor from './processor';

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
   * @param name The watcher name
   * @param network The network name
   * @param provider The network provider
   * @param processor The processor object
   * @param notifierService The notification service
   */
  constructor(
    public name: string,
    public network: string,
    private provider: providers.JsonRpcProvider,
    private processor: Processor,
  ) {}

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
    return !this.name ? `sync_height:${this.network}` : `sync_height:${this.name}:${this.network}`;
  }

  /**
   * Get launch height
   * @private
   */
  private getLaunchHeight() {
    const key = !this.name ? 'LAUNCH_HEIGHT' : `LAUNCH_HEIGHT_${this.name}`;
    return process.env[key] || '1';
  }

  private logInfo(message: any, context?: string) {
    const watcherId = this.name ? `:${this.name}` : '';
    this.logger.log(`Watcher${watcherId}: ${message}`, context);
  }

  private logError(message: any, context?: string) {
    const watcherId = this.name ? `:${this.name}` : '';
    this.logger.error(`Watcher${watcherId}: ${message}`, context);
  }

  /**
   * Get event from log
   * @param log The log object
   * @param iface The contract interface
   * @returns
   */
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
   * Fetch and process events
   * @param prevBlock The previous block
   * @param curBlock The current block
   * @returns
   */
  async fetchAndProcessEvents(prevBlock: number, curBlock: number) {
    // Query latest logs for all contracts
    const logs = await this.provider.send('eth_getLogs', [
      {
        fromBlock: ethers.utils.hexValue(prevBlock),
        toBlock: ethers.utils.hexValue(curBlock),
        topics: [],
        address: this.handlers
          .map((h) => h.getContract().address)
          .filter((addr) => {
            return !isEqualStr(constants.AddressZero, addr);
          }),
      },
    ]);

    // Extract the events from the logs
    const events: ethers.Event[] = [
      ...logs.map((log: ethers.providers.Log) => {
        const handler = this.handlers.find((h) => isEqualStr(h.getContract().address, log.address));
        return this.getEventFromLog(log, handler.getContract().interface);
      }),
    ];

    return Promise.all(
      events.map((e) => {
        const deferred = defer();
        this.processor.addEvent({
          event: e,
          block: BigNumber.from(e.blockNumber).toNumber(),
          txIndex: BigNumber.from(e.transactionIndex).toNumber(),
          eventIndex: BigNumber.from(e.logIndex).toNumber(),
          contract: e.address,
          promise: deferred,
        });
        return deferred.promise;
      }),
    );
  }

  /**
   * Watch for event on new block
   */
  watchBlock() {
    const listener = async (curBlock: number) => {
      try {
        const key = this.makeSyncKey();
        let meta = await Meta.get(key);
        if (!meta) meta = new Meta({ value: this.getLaunchHeight() });
        if (parseInt(meta.value) >= curBlock) {
          this.logInfo(`Block ${curBlock} already processed`);
          return;
        }

        this.logInfo(`New block: ${curBlock}`);

        // Process events
        await this.fetchAndProcessEvents(parseInt(meta.value), curBlock);

        this.logInfo(`Finished processing block: ${curBlock}`);

        // Update the last sync height
        await Meta.update(key, curBlock.toString());
      } catch (e) {
        this.logError(e);
        this.provider.off('block', listener);
        if (!this.isSyncing) this.interval = this.sync();
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
            meta = new Meta({ value: this.getLaunchHeight() });
          }

          // Ensure we are not fully synchronized yet.
          // If we are, stop watching on interval. Instead, watch on new block.
          const curBlock = await this.provider.getBlockNumber();
          if (parseInt(meta.value) == curBlock) {
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

          this.logInfo(`Syncing blocks between ${startBlock} and ${endBlock} (Current Head: ${curBlock})`);

          // Process events
          await this.fetchAndProcessEvents(startBlock, endBlock);

          // Update the last sync height
          await Meta.update(key, endBlock.toString());
        } catch (e) {
          this.logError(e.message, e.stack);
        } finally {
          this.isSyncing = false;
        }
      },
      isDev() ? 100 : 1000,
    );
  }
}
