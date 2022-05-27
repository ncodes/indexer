import { Contract, Event as Evt } from 'ethers';
import Event from '../models/events';

export class Handler {
  on(contract: Contract, event: string, f: (...args: any[]) => void) {
    contract.on(event, async (...args: any[]) => {
      // Ensure only events that have not been seen are processed
      const event: Evt = args[args.length - 1];
      const exist = await Event.exists(
        event.eventSignature,
        event.blockNumber,
        event.transactionIndex,
        event.logIndex,
      );
      if (exist) return;

      // Call event processor and register event
      f(...args);
      await Event.create({
        signature: event.eventSignature,
        blockNumber: event.blockNumber,
        txIndex: event.transactionIndex,
        logIndex: event.logIndex,
      });
    });
  }
}
