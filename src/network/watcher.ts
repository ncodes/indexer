import { Logger } from '@nestjs/common';
import { ethers, Interface, Log, LogDescription, Provider, ZeroAddress } from 'ethers';
import { delay, isEqualStr } from '../common/common';
import Meta from '../models/meta';
import { ContractCallEvent } from './common';
import { Handler } from './handler';
import Processor from './processor';

export class Watcher {
  private logger = new Logger(Watcher.name);
  private handlers: Handler[] = [];
  private isSyncing = false;
  private lastActiveTime = Date.now();
  private pendingBlocks: number[] = [];
  private priorityPendingBlocks: number[] = [];
  private processingPendingBlocks = false;

  // If topics are set, only listen to these topics.
  // Map handler to topics
  private topics: string[] = [];

  /**
   * Initialize the watcher
   * @param name The watcher name
   * @param network The network name
   * @param provider The network provider
   * @param processor The processor object
   * @param batchSize The amount of events to process per time
   */
  constructor(
    public name: string,
    public network: string,
    private provider: Provider,
    private processor: Processor,
    private batchSize: number,
  ) {}

  setTopics(topics: string[]) {
    this.topics = topics;
  }

  /**
   * Add handlers and start synchronizing them
   * @param handlers one or more handlers
   */
  async add(...handlers: Handler[]) {
    this.handlers = handlers;
    void this.sync();
    this.processPendingBlocks();
  }

  /**
   * Make last sync key
   * @private
   */
  private makeSyncKey() {
    return `sync_height:${this.name}:${this.network}`;
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
    return process.env[`LAUNCH_HEIGHT_${this.name.toUpperCase()}`] || '1';
  }

  private logInfo(message: any, context?: any) {
    this.logger.log(`Watcher:${this.name}: ${message}`, JSON.stringify(context));
  }

  private logError(message: any, context?: any) {
    this.logger.error(`Watcher:${this.name}: ${message}`, context);
  }

  parsedLogToCallEvent(parsed: LogDescription, log: Log, contractAddress?: string) {
    if (!parsed) return;
    return {
      event: parsed.name,
      args: parsed.args,
      blockNumber: log.blockNumber,
      logIndex: log.index,
      transactionIndex: log.transactionIndex,
      transactionHash: log.transactionHash,
      address: log.address,
      contract: contractAddress,
      eventSignature: parsed.signature,
      removed: log.removed,
      getBlock: () => this.provider.getBlock(log.blockNumber),
      getTransaction: () => this.provider.getTransaction(log.transactionHash),
    };
  }

  /**
   * Get event from log
   * @param log The log object
   * @param iface The contract interface
   * @param contractAddress The contract address
   * @returns
   */
  getEventFromLog(log: Log, iface: Interface, contractAddress?: string): ContractCallEvent {
    const parsed = iface.parseLog({
      data: log.data,
      topics: log.topics as string[],
    });
    return this.parsedLogToCallEvent(parsed, log, contractAddress);
  }

  /**
   * Fetch and process events
   * @param prevBlock The previous block
   * @param curBlock The current block
   * @returns
   */
  async fetchAndProcessEvents(prevBlock: number, curBlock: number) {
    try {
      this.logInfo(`Fetching events`, { curBlock });

      // Query latest logs for all contracts
      const encodedTopics = this.topics.map((t) => ethers.keccak256(ethers.toUtf8Bytes(t)));
      const logs = await this.provider.getLogs({
        fromBlock: prevBlock ? prevBlock : curBlock,
        toBlock: curBlock,
        topics: encodedTopics,
        address:
          this.topics.length == 0
            ? this.handlers
                .filter((h) => !!h.getContract())
                .map((h) => h.getContract().target)
                .filter((addr) => {
                  return !isEqualStr(ZeroAddress, addr as string);
                })
            : undefined,
      });

      this.logInfo(`Found ${logs.length} logs`);

      // Extract the events from the logs
      let events: ContractCallEvent[] = [
        ...logs.map((log: Log) => {
          const handler = this.handlers.find((h) => isEqualStr(h.getContract().target as string, log.address));
          return this.getEventFromLog(log, handler.getContract().interface);
        }),
      ];

      events = events.filter((e) => !!e);

      this.lastActiveTime = Date.now();

      return Promise.all(
        events.map((e) => {
          return this.processor.addEvent({
            event: e,
            block: e.blockNumber,
            txIndex: e.transactionIndex,
            eventIndex: e.logIndex,
            contract: e.contract ? e.contract : e.address,
          });
        }),
      );
    } catch (e) {
      if (e instanceof Error) {
        if (e.message.includes('missing revert data') || e.message.includes('could not decode result data')) {
          this.logError('Error:fetchAndProcessEvents: ', e);
          return;
        }
      }

      throw e;
    }
  }

  processPendingBlocks() {
    setInterval(async () => {
      if (this.processingPendingBlocks) return;
      this.processingPendingBlocks = true;

      // Process priority pending blocks first
      if (this.priorityPendingBlocks.length > 0) {
        const blocks = [...this.priorityPendingBlocks];
        this.logInfo(`Processing priority pending blocks`, { from: blocks[0] - 1, to: blocks[blocks.length - 1] });
        await this.fetchAndProcessEvents(blocks[0] - 1, blocks[blocks.length - 1]);
        this.logInfo(`Finished processing priority blocks`, { from: blocks[0] - 1, to: blocks[blocks.length - 1] });
        this.priorityPendingBlocks = [];
        this.processingPendingBlocks = false;
        return;
      }

      // If the size of the pending blocks is less than the batch size, return
      if (this.pendingBlocks.length < this.batchSize) {
        this.processingPendingBlocks = false;
        return;
      }

      // Slice pending block up to batch size
      const blocks = this.pendingBlocks.splice(0, this.batchSize);

      if (blocks.length == 0) {
        this.processingPendingBlocks = false;
        return;
      }

      try {
        const lastBlock = blocks[blocks.length - 1];
        const key = this.makeSyncKey();
        let meta = await Meta.get(key);
        if (!meta || meta.value == '0') meta = new Meta({ value: this.getLaunchHeight() });

        this.logInfo(`Processing pending blocks`, { from: blocks[0] - 1, to: lastBlock });

        await this.fetchAndProcessEvents(blocks[0] - 1, lastBlock);
        this.logInfo(`Finished processing blocks`, { from: blocks[0] - 1, to: lastBlock });

        if (parseInt(meta.value) < lastBlock) await Meta.update(key, lastBlock.toString());
      } catch (e) {
        this.logError('Error:processPendingBlocks: ', e);
        this.logError('Attempt to restarting sync after processPendingBlocks error');
        this.pendingBlocks = [...blocks, ...this.pendingBlocks];
        this.pendingBlocks.sort();
      } finally {
        this.processingPendingBlocks = false;
      }
    }, 1000);
  }

  addToPendingBlocks(block: number) {
    this.pendingBlocks.push(block);
    this.pendingBlocks.sort();
    this.logInfo('Pending Blocks', this.pendingBlocks);
  }

  addToPriorityPendingBlocks(block: number) {
    this.priorityPendingBlocks.push(block);
    this.priorityPendingBlocks.sort();
    this.logInfo('Priority Pending Blocks', this.priorityPendingBlocks);
  }

  watchBlock() {
    const listener = async (curBlock: number) => {
      try {
        const key = this.makeSyncKey();
        let meta = await Meta.get(key);
        if (!meta || meta.value == '0') meta = new Meta({ value: this.getLaunchHeight() });
        if (parseInt(meta.value) >= curBlock) return;
        this.addToPendingBlocks(curBlock);
      } catch (e) {
        this.logError('Error:watchBlock: ', e);
        void this.provider.off('block', listener);
        this.logError('Attempt to restarting sync after watchBlock error');
        void this.sync();
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
      const watchRange = `WATCH_RANGE_${this.name.toUpperCase()}`;
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
      void this.sync();
    } catch (e) {
      this.logError(`Error:sync(): ` + e.message, e.stack);
      this.logInfo('Attempt to restarting sync() after sync error');
      this.isSyncing = false;
      await delay(5000);
      void this.sync();
    }
  }
}
