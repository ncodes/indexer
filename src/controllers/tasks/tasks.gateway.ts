import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { isEthereumAddress } from 'class-validator';
import { Server, Socket } from 'socket.io';
import { isTestMode } from '../../common/common';
import { build400, build500, ok } from '../../common/responses/responses';
import MineTask from '../../models/mine_task';
import { MinerTaskDurations, isValidNetwork } from '../../network/common';

type QueuedTask = {
  task: MineTask;
  queuedAt: number;
  minerId?: string;
};

export function makeMinerId(network: string, address: string) {
  return `miner_${network}_${address}`;
}

class Miner {
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

@WebSocketGateway({ namespace: '/v1/mining' })
export class TasksGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private logger = new Logger('TasksWebSocket');
  disabled = false;
  @WebSocketServer() server: Server;
  minersQueue: { [network: string]: Miner[] } = {};
  knownMiners: { [minerId: string]: Miner } = {};
  minerTask: { [minerId: string]: QueuedTask } = {};
  queue: MineTask[] = [];
  queuedTasks: { [id: string]: QueuedTask } = {};
  clientAddress: { [clientId: string]: string } = {};

  constructor(private cfgSrv: ConfigService) {
    this.disabled = this.cfgSrv.get('app.disableMineTaskProcessing') == 'true';
    if (this.disabled) {
      this.logger.log('Task processing is disabled');
      return;
    }

    if (!isTestMode()) {
      setInterval(() => {
        this.produceTasks();
      }, 5000);

      setInterval(() => {
        this.assignTask();
      }, 1000);

      setInterval(() => {
        this.logger.log(`Miners: ${Object.keys(this.knownMiners).length} / Queue Size: ${this.queue.length}`);
      }, 5000);
    }
  }

  afterInit() {
    this.logger.log('Websocket initialized');
  }

  handleConnection() {
    this.logger.log('Websocket connected');
  }

  handleDisconnect(client: Socket) {
    this.logger.log('Websocket disconnected', client.id);
    this.cleanUpMiner(client.id);
  }

  /**
   * Register miner
   * @param data The request info
   * @returns
   */
  @SubscribeMessage('register')
  async handleRegisterMiner(
    @ConnectedSocket() client: Socket,
    @MessageBody('network') network: string,
    @MessageBody('address') address: string,
  ) {
    if (this.disabled) {
      return build500('task processing is disabled');
    }

    if (!network) {
      return build400('network is required');
    }

    if (!isValidNetwork(network)) {
      return build400('network is invalid');
    }

    if (!address) {
      return build400('miner address is required');
    }

    if (!isEthereumAddress(address)) {
      return build400('miner address is invalid');
    }

    const minerId = makeMinerId(network, address);
    if (this.knownMiners[minerId] === undefined) {
      const miner = new Miner({
        network,
        address,
        socket: client,
        queueIndex: (this.minersQueue[network] || []).length,
      });
      this.minersQueue[network] = [...(this.minersQueue[network] || []), miner];
      this.knownMiners[miner.id] = miner;
      this.logger.debug(`Miner registered`, JSON.stringify({ minerId: miner.id, clientId: client.id }));
    } else {
      const curTask = this.minerTask[minerId];
      if (curTask) {
        this.checkTaskStatus(curTask);
      }
    }

    return ok().data({ ok: true }).build();
  }

  /**
   * Fetch uncompleted tasks from database into the queue.
   * If task is already in the queue, check its status.
   */
  async produceTasks() {
    const tasks = await MineTask.fetchMineable(undefined, undefined, 100, 0);
    for (const t of tasks) {
      if (this.queuedTasks[t.id]) {
        this.checkTaskStatus(this.queuedTasks[t.id]);
        continue;
      }
      this.queuedTasks[t.id] = { task: t, queuedAt: Date.now() / 1000 };
      this.queue.push(t);
    }
  }

  /**
   * Assign task to a miner. If no miner is available, put it back to the queue
   * if it's not already in the queue.
   * If unable to assign task to a miner, remove the miner from the pool and
   * put the task back to the queue if it's not already in the queue.
   * @param queuedTask An already queued task
   * @returns Error if unable to emit task to miner socket
   */
  assignTask(queuedTask?: MineTask) {
    const task = queuedTask || this.queue.shift();
    if (!task) {
      return 'No task available';
    }

    const miners = this.minersQueue[task.network] || [];
    const miner = miners.shift();
    if (!miner) {
      this.logger.debug(`No miner available for ${task.network}`);
      if (!queuedTask) this.queue.push(task);
      return 'No miner available';
    } else if (!miner.socket.connected) {
      return 'Miner disconnected';
    }

    try {
      miner.socket.emit('task', task, () => {
        this.queuedTasks[task.id].minerId = miner.id;
        this.minerTask[miner.id] = this.queuedTasks[task.id];
        this.logger.debug(`Assigned task ${task.id} to ${miner.address}`);
      });
      return 'ok';
    } catch (error) {
      this.minersQueue[task.network].splice(miner.queueIndex, 1);
      delete this.knownMiners[miner.id];
      if (!queuedTask) this.queue.push(task);
      return new Error('failed to emit');
    }
  }

  /**
   * Check whether a task is completed.
   * If not completed after a period of time, reassign it to another miner.
   * @param queuedTask The queued task
   */
  async checkTaskStatus(queuedTask: QueuedTask) {
    // Wait for a period of time before checking task status
    if (Date.now() / 1000 - queuedTask.queuedAt <= (MinerTaskDurations[queuedTask.task.network] || 60)) {
      return;
    }

    this.logger.debug('Checking task status', queuedTask.task.id);

    // If task is completed, remove it from queued list
    const task = await MineTask.getById(queuedTask.task.id);
    if (task.completed) {
      this.logger.debug(`Task completed`, queuedTask.task.id);
      delete this.queuedTasks[task.id];
    }

    // If not completed, reassign task to another miner
    if (!task.completed && this.assignTask(task) instanceof Error) {
      return;
    }

    // Add the previously assigned miner back to the pool
    delete this.minerTask[queuedTask.minerId];
    this.minersQueue[task.network].push(this.knownMiners[queuedTask.minerId]);
  }

  /**
   * Clean up miner whose socket is disconnected
   * @param clientId The client id
   */
  cleanUpMiner(clientId: string) {
    for (const minerId in this.knownMiners) {
      if (this.knownMiners[minerId].socket.id === clientId) {
        delete this.knownMiners[minerId];
        delete this.minerTask[minerId];
        this.logger.debug(`Disconnected miner was removed`, minerId);
      }
    }
  }
}
