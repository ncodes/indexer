import { Logger } from '@nestjs/common';
import { Interface, Log, Provider, ZeroAddress } from 'ethers';
import { delay, isEqualStr } from '../common/common';
import Meta from '../models/meta';
import { ContractCallEvent } from './common';
import { Handler } from './handler';
import Processor from './processor';

export class Watcher {
  logger = new Logger(Watcher.name);
  handlers: Handler[] = [];
  private isSyncing = false;
  private lastActiveTime = Date.now();

  /**
   * Initialize the watcher
   * @param name The watcher name
   * @param network The network name
   * @param provider The network provider
   * @param processor The processor object
   */
  constructor(public name: string, public network: string, private provider: Provider, private processor: Processor) {}

  /**
   * Add handlers and start synchronizing them
   * @param handlers one or more handlers
   */
  async add(...handlers: Handler[]) {
    this.handlers = handlers;
    this.sync();
  }

  /**
   * Make last sync key
   * @private
   */
  private makeSyncKey() {
    return !this.name ? `sync_height:${this.network}` : `sync_height:${this.name}:${this.network}`;
  }

  /**
   * Get last active time
   * @returns The last active time
   */
  getLastActiveTime() {
    return this.lastActiveTime;
  }

  /**
   * Get launch height
   * @private
   */
  private getLaunchHeight() {
    const key = !this.name ? 'LAUNCH_HEIGHT' : `LAUNCH_HEIGHT_${this.name}`;
    return process.env[key] || '1';
  }

  private logInfo(message: any, context?: any) {
    const watcherId = this.name ? `:${this.name}` : '';
    this.logger.log(`Watcher${watcherId}: ${message}`, JSON.stringify(context));
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
  getEventFromLog(log: Log, iface: Interface): ContractCallEvent {
    const parsed = iface.parseLog({
      data: log.data,
      topics: log.topics as string[],
    });
    return {
      event: parsed.name,
      args: parsed.args,
      blockNumber: log.blockNumber,
      logIndex: log.index,
      transactionIndex: log.transactionIndex,
      transactionHash: log.transactionHash,
      address: log.address,
      eventSignature: parsed.signature,
      removed: log.removed,
      getBlock: () => this.provider.getBlock(log.blockNumber),
      getTransaction: () => this.provider.getTransaction(log.transactionHash),
    };
  }

  /**
   * Fetch and process events
   * @param prevBlock The previous block
   * @param curBlock The current block
   * @returns
   */
  async fetchAndProcessEvents(prevBlock: number, curBlock: number) {
    this.logInfo(`Fetching events`, { curBlock });

    // Query latest logs for all contracts
    const logs = await this.provider.getLogs({
      fromBlock: prevBlock ? prevBlock : curBlock,
      toBlock: curBlock,
      address: this.handlers
        .map((h) => h.getContract().target)
        .filter((addr) => {
          return !isEqualStr(ZeroAddress, addr as string);
        }),
    });

    this.logInfo(`Found ${logs.length} logs`);

    // Extract the events from the logs
    const events: ContractCallEvent[] = [
      ...logs.map((log: Log) => {
        const handler = this.handlers.find((h) => isEqualStr(h.getContract().target as string, log.address));
        return this.getEventFromLog(log, handler.getContract().interface);
      }),
    ];

    this.lastActiveTime = Date.now();

    return Promise.all(
      events.map((e) => {
        return this.processor.addEvent({
          event: e,
          block: e.blockNumber,
          txIndex: e.transactionIndex,
          eventIndex: e.logIndex,
          contract: e.address,
        });
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
        if (!meta || meta.value == '0') meta = new Meta({ value: this.getLaunchHeight() });
        if (parseInt(meta.value) >= curBlock) {
          return;
        }

        this.logInfo(`New block: ${curBlock}`, { isSyncing: this.isSyncing });

        // Process events
        await this.fetchAndProcessEvents(curBlock - 1, curBlock);

        this.logInfo(`Finished processing block: ${curBlock}`);

        // Update the last sync height
        await Meta.update(key, curBlock.toString());
      } catch (e) {
        this.logError('Error:watchBlock: ', e);
        this.provider.off('block', listener);
        this.logError('Attempt to restarting sync after watchBlock error');
        this.sync();
      }
    };

    // register 'block' event listener
    this.provider.removeAllListeners('block').then(() => {
      this.provider.on('block', listener);
    });
  }

  async sync() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      // Get last synced block height
      const key = this.makeSyncKey();
      let meta = await Meta.get(key);
      if (!meta || meta.value == '0') meta = new Meta({ value: this.getLaunchHeight() });
      const curBlock = await this.provider.getBlockNumber();
      this.logInfo(`Last synced block: ${meta.value}`, { 'Current Head': curBlock });

      // Ensure we are not fully synchronized yet.
      // If we are, stop watching on interval. Instead, watch on new block.
      if (parseInt(meta.value) == curBlock) {
        this.logInfo(`Watcher is fully synchronized at block ${curBlock}`);
        this.watchBlock();
        this.isSyncing = false;
        return;
      }

      // Determine the start and end block height
      const watchRange = this.name ? `WATCH_RANGE_${this.name}` : 'WATCH_RANGE';
      let endBlock = process.env[watchRange]
        ? parseInt(process.env[watchRange]) + parseInt(meta.value)
        : parseInt(meta.value) + 1;
      endBlock = endBlock > curBlock ? curBlock : endBlock;
      const startBlock = parseInt(meta.value) + 1;

      this.logInfo(`Syncing blocks between ${startBlock} and ${endBlock} (Current Head: ${curBlock})`);

      // Process events
      await this.fetchAndProcessEvents(startBlock, endBlock);

      // Update the last sync height
      await Meta.update(key, endBlock.toString());

      this.isSyncing = false;
      this.sync();
    } catch (e) {
      this.logError(`Error:sync(): ` + e.message, e.stack);
      this.logInfo('Attempt to restarting sync() after sync error');
      this.isSyncing = false;
      await delay(5000);
      this.sync();
    }
  }
}
