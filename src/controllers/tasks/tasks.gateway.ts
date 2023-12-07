import { isValidChain } from '@jointlabs/chains-info';
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
import { isTest } from '../../common/common';
import { build400, build500, ok } from '../../common/responses/responses';
import MineTask from '../../models/mine_task';
import { MinerTaskDurations } from '../../network/common';
import { Miner, QueuedTask, makeMinerId } from './types';

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

    if (!isTest()) {
      setInterval(() => {
        this.logger.debug('Producing tasks...');
        this.produceTasks();
      }, 5000);

      setInterval(() => {
        this.logger.debug('Assigning tasks...');
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

    if (!isValidChain(network)) {
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
      this.logger.debug(
        `handleRegisterMiner: Miner registered`,
        JSON.stringify({ minerId: miner.id, clientId: client.id }),
      );
    } else {
      this.logger.debug(
        `handleRegisterMiner: Miner already registered`,
        JSON.stringify({ minerId: minerId, clientId: client.id }),
      );
      const curTask = this.minerTask[minerId];
      if (curTask) {
        this.logger.debug(
          'handleRegisterMiner: Checking miner existing task',
          JSON.stringify({ minerId: minerId, clientId: client.id }),
        );
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
    this.logger.debug('produceTasks: Fetching new tasks', JSON.stringify({ count: tasks.length }));
    for (const t of tasks) {
      if (this.queuedTasks[t.id]) {
        this.logger.debug('produceTasks: Checking existing task', JSON.stringify({ task: t.id }));
        this.checkTaskStatus(this.queuedTasks[t.id]);
        continue;
      }
      this.queuedTasks[t.id] = { task: t, assignedAt: 0 };
      this.queue.push(t);
      this.logger.debug('produceTasks: New task added to queue', JSON.stringify({ task: t.id }));
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
      this.logger.debug('assignTask: No new task available');
      return 'No task available';
    }

    const miners = this.minersQueue[task.network] || [];
    const miner = miners.shift();
    if (!miner) {
      this.logger.debug(`assignTask: No miner available for ${task.network}`);
      if (!queuedTask) this.queue.push(task);
      return 'No miner available';
    } else if (!miner.socket.connected) {
      return 'Miner disconnected';
    }

    try {
      miner.socket.emit('task', task, () => {
        this.queuedTasks[task.id].minerId = miner.id;
        this.queuedTasks[task.id].assignedAt = Date.now() / 1000;
        this.minerTask[miner.id] = this.queuedTasks[task.id];
        this.logger.debug(`assignTask: Assigned task ${task.id} to ${miner.address}`);
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
   * @param task The queued task
   */
  async checkTaskStatus(task: QueuedTask) {
    // Wait for a period of time before checking task status
    if (Date.now() / 1000 - task.assignedAt <= (MinerTaskDurations[task.task.network] || 60)) {
      const timeLeft = Date.now() / 1000 - task.assignedAt;
      this.logger.debug(
        `checkTaskStatus: Waiting for miner to complete task`,
        JSON.stringify({ task: task.task.id, timeLeft }),
      );
      return;
    }

    this.logger.debug(`checkTaskStatus: Checking miner's task status`, task.task.id);

    // If task is completed, remove it from queued list
    const taskInfo = await MineTask.getById(task.task.id);
    if (taskInfo.completed) {
      this.logger.debug(`checkTaskStatus: Task completed`, task.task.id);
      delete this.queuedTasks[taskInfo.id];
    }

    // If not completed, reassign task to another miner
    if (!taskInfo.completed) {
      const err = this.assignTask(taskInfo) instanceof Error;
      if (err) {
        this.logger.debug(`checkTaskStatus: Failed to reassign task: ${err}`, JSON.stringify({ task: task.task.id }));
      }
    }

    // Add the previously assigned miner back to the pool
    if (task.minerId) {
      this.logger.debug('checkTaskStatus: Removing task from miner and adding miner back to queue');
      delete this.minerTask[task.minerId];
      this.minersQueue[taskInfo.network].push(this.knownMiners[task.minerId]);
    }
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
        this.logger.debug(`cleanUpMiner: Disconnected miner was removed`, minerId);
      }
    }
  }
}
