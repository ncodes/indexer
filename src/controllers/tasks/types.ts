import { Socket } from 'socket.io';
import MineTask from '../../models/mine_task';

export type QueuedTask = {
  task: MineTask;
  assignedAt: number;
  minerId?: string;
};

export function makeMinerId(network: string, address: string) {
  return `miner_${network}_${address}`;
}

export class Miner {
  network: string;
  address: string;
  socket: Socket;
  queueIndex: number;

  constructor({ network, address, socket, queueIndex }: Partial<Miner>) {
    this.network = network;
    this.address = address;
    this.socket = socket;
    this.queueIndex = queueIndex;
  }

  get id() {
    return makeMinerId(this.network, this.address);
  }
}
