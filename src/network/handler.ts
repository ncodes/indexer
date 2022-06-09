import { Logger } from '@nestjs/common';
import { Contract, ContractInterface, ethers, Signer } from 'ethers';
import Event from '../models/events';
import { Provider } from '@ethersproject/abstract-provider';
import Meta from '../models/meta';
import { EventEmitter2 } from 'eventemitter2';
import { isTestMode } from '../common/common';

/**
 * Handle handles contract events.
 */
export class Handler extends EventEmitter2 {
  logger = new Logger(Handler.name);

  /**
   * Initialize the handler
   * @param network The network name
   * @param contract The contract to be handled
   */
  constructor(public network: string, private contract: Contract) {
    super();
    if (!isTestMode()) this.watch();
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

  shortenAddr(addr: string) {
    return `${addr.substr(0, 4)}...${addr.substr(addr.length - 4)}`;
  }

  /**
   * Watch the blockchain for new events
   */
  watch() {
    setInterval(async () => {
      try {
        // Get last synced block height
        const key = `lastSyncedHeight_${this.network}_${this.contract.address}`;
        let meta = await Meta.get(key);
        if (!meta) {
          meta = new Meta({
            value: process.env[`LAUNCH_HEIGHT_${this.network.toUpperCase()}`] || '1',
          });
        }

        // Ensure next sync height is not greater than current block height
        const curBlock = await this.contract.provider.getBlockNumber();
        if (parseInt(meta.value) + 1 > curBlock) return;

        // Query events
        let endBlock = process.env.WATCH_RANGE
          ? parseInt(process.env.WATCH_RANGE) + parseInt(meta.value)
          : parseInt(meta.value) + 1;
        endBlock = endBlock > curBlock ? curBlock : endBlock;
        const startBlock = parseInt(meta.value) + 1;
        const events = await this.contract.queryFilter({}, startBlock, endBlock);

        if (events.length) {
          this.logger.debug(
            `Contract(${this.shortenAddr(this.contract.address)}/${this.network}) Found ${
              events.length
            } event(s) at Block #${startBlock}`,
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
