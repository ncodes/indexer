import { Logger } from '@nestjs/common';
import { Contract, ContractInterface, ethers, Signer } from 'ethers';
import Event from '../models/events';
import { Provider } from '@ethersproject/abstract-provider';
import Meta from '../models/meta';
import { EventEmitter2 } from 'eventemitter2';
import { isTestMode } from '../common/common';
import { shortenAddr } from '../common/utils/helpers';

/**
 * Handle handles contract events.
 */
export class Handler extends EventEmitter2 {
  logger = new Logger(Handler.name);
  private watchInterval: NodeJS.Timeout;

  /**
   * Initialize the handler
   * @param network The network name
   * @param contract The contract to be handled
   */
  constructor(public network: string, private contract: Contract) {
    super();
    if (!isTestMode()) this.sync();
  }

  /**
   * Create an ethers.js Contract object
   * @param addressOrName The contract address
   * @param contractInterface The contract ABI
   * @param signerOrProvider The provider or signer
   */
  newContract(
    addressOrName: string,
    contractInterface: ContractInterface,
    signerOrProvider: Signer | Provider,
  ) {
    return new Contract(addressOrName, contractInterface, signerOrProvider);
  }

  /**
   * Emit an event that has not previously been emitted
   * @param e The target event to be emitted
   */
  async emitUnique(e: ethers.Event) {
    this.logger.debug(`Event:${e.event}: processing an event...`);
    const txn = await Event.startTransaction();
    const args = [...e.args.slice(0, e.args.length), e, txn];
    try {
      await Event.bindTransaction(txn).create({
        network: this.network,
        signature: e.eventSignature,
        blockNumber: e.blockNumber,
        txIndex: e.transactionIndex,
        logIndex: e.logIndex,
      });
      await this.emitAsync(e.event, ...args);
      await txn.commit();
      this.logger.debug(`Event:${e.event}: finished processing an event`);
    } catch (error) {
      await txn.rollback();
      if (error.message.indexOf('duplicate key') !== -1) return Promise.resolve();
      this.logger.error(`Event Execution Error: ${error.message}`);
      return Promise.reject(error);
    }
  }

  /**
   * Watch for event on new block
   */
  watchBlock() {
    this.contract.provider.on('block', async (curBlock: number) => {
      // Query events
      const events = await this.contract.queryFilter({}, curBlock);
      if (events.length) {
        const shortAddr = shortenAddr(this.contract.address);
        this.logger.debug(
          `Contract(${shortAddr}/${this.network}) Found ${events.length} event(s) at Block #${curBlock}`,
        );

        // Emit the events
        for (const e of events) {
          await this.emitUnique(e);
        }
      }

      // Update the last sync height
      const key = `lastSyncedHeight_${this.network}_${this.contract.address}`;
      await Meta.update(key, curBlock.toString());
    });
  }

  /**
   * Process events from the last time the contract
   * was last synchronized to the current block.
   * If the contract is fully synchronized, switch to block
   * watching to process real-time events
   */
  sync() {
    this.watchInterval = setInterval(async () => {
      try {
        // Get last synced block height
        const key = `lastSyncedHeight_${this.network}_${this.contract.address}`;
        let meta = await Meta.get(key);
        if (!meta) {
          meta = new Meta({
            value: process.env[`LAUNCH_HEIGHT_${this.network.toUpperCase()}`] || '1',
          });
        }

        // Ensure we are not fully synchronized yet.
        // If we are, stop watching on interval. Instead, watch on new block.
        const curBlock = await this.contract.provider.getBlockNumber();
        if (parseInt(meta.value) + 1 > curBlock) {
          clearInterval(this.watchInterval);
          this.watchBlock();
          return;
        }

        // Query events
        let endBlock = process.env.WATCH_RANGE
          ? parseInt(process.env.WATCH_RANGE) + parseInt(meta.value)
          : parseInt(meta.value) + 1;
        endBlock = endBlock > curBlock ? curBlock : endBlock;
        const startBlock = parseInt(meta.value) + 1;
        const events = await this.contract.queryFilter({}, startBlock, endBlock);

        if (events.length) {
          const shortAddr = shortenAddr(this.contract.address);
          this.logger.debug(
            `Contract(${shortAddr}/${this.network}) Found ${events.length} event(s) at Block #${startBlock}`,
          );

          // Emit the events
          for (const e of events) {
            await this.emitUnique(e);
          }
        }

        // Update the last sync height
        await Meta.update(key, endBlock.toString());
      } catch (e) {
        this.logger.error('watch(): ' + e.message);
      }
    }, 3000);
  }
}
