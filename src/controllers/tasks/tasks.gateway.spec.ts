import { HttpException, INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import MineTask, { MineTaskType } from '../../models/mine_task';

import { ChainNames } from '@jointlabs/chains-info';
import { AssignFuncResult, CheckStatusFuncResult, TasksGateway } from './tasks.gateway';
import { QueuedTask, makeMinerId } from './types';

// eslint-disable-next-line no-var
var minerTaskDuration = 100;
jest.mock('../../network/common', () => {
  const actual = jest.requireActual('../../network/common');
  return {
    ...actual,
    MinerTaskDurations: {
      ...actual.MinerTaskDurations,
      ethereum: minerTaskDuration,
    },
  };
});

const mockCfgGet = jest.fn();
const ConfigServiceMock = jest.fn().mockImplementation(() => {
  return { get: mockCfgGet };
});

describe('TaskGateway', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let gateway: TasksGateway;
  const net: ChainNames = 'ethereum';
  const cfgObj = {};

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.truncateTables();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    mockCfgGet.mockReset().mockImplementation((args) => {
      return cfgObj[args];
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      providers: [TasksGateway],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigServiceMock())
      .compile();
    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    app.useGlobalFilters(new AllExceptionsFilter());
    gateway = app.get(TasksGateway);
  });

  describe('.handleRegisterMiner', () => {
    let task: MineTask;

    beforeEach(async () => {
      task = await MineTask.create({
        type: MineTaskType.Draft,
        orderId: 0,
        network: net,
        marketAddress: '0xMarket',
      });
    });

    it('should return error when disabled', async () => {
      gateway.disabled = true;
      const resp = await gateway.handleRegisterMiner(null, '', '');
      expect(resp).toBeInstanceOf(HttpException);
      expect((resp as HttpException).getResponse()).toEqual({
        error: {
          message: 'task processing is disabled',
        },
      });
    });

    it('should return error when network was not provided', async () => {
      const resp = await gateway.handleRegisterMiner(null, '', '');
      expect(resp).toBeInstanceOf(HttpException);
      expect((resp as HttpException).getResponse()).toEqual({
        error: {
          param: undefined,
          type: 'invalid_request_error',
          message: 'network is required',
        },
      });
    });

    it('should return error when network is invalid', async () => {
      const resp = await gateway.handleRegisterMiner(null, 'net1', '');
      expect(resp).toBeInstanceOf(HttpException);
      expect((resp as HttpException).getResponse()).toEqual({
        error: {
          param: undefined,
          type: 'invalid_request_error',
          message: 'network is invalid',
        },
      });
    });

    it('should return error when miner address is required', async () => {
      const resp = await gateway.handleRegisterMiner(null, net, '');
      expect(resp).toBeInstanceOf(HttpException);
      expect((resp as HttpException).getResponse()).toEqual({
        error: {
          param: undefined,
          type: 'invalid_request_error',
          message: 'miner address is required',
        },
      });
    });

    it('should return error when miner address is invalid', async () => {
      const resp = await gateway.handleRegisterMiner(null, net, '0x123');
      expect(resp).toBeInstanceOf(HttpException);
      expect((resp as HttpException).getResponse()).toEqual({
        error: {
          param: undefined,
          type: 'invalid_request_error',
          message: 'miner address is invalid',
        },
      });
    });

    it('should return add new miner to queue', async () => {
      const socket = {};
      const resp = await gateway.handleRegisterMiner(socket as any, net, '0xB24780438dD4DB52848A3A398B1A8A08223aBd83');
      expect(resp).toBeInstanceOf(Object);
      expect(resp).toEqual({
        data: {
          ok: true,
        },
      });

      expect(gateway.minersQueue[net]).toHaveLength(1);
      const miner = gateway.minersQueue[net][0];
      expect(miner.address).toEqual('0xB24780438dD4DB52848A3A398B1A8A08223aBd83');
      expect(miner.network).toEqual(net);
      expect(miner.socket).toEqual(socket);
      expect(miner.queueIndex).toEqual(0);
      expect(miner.id).toEqual(makeMinerId(net, '0xB24780438dD4DB52848A3A398B1A8A08223aBd83'));
      const minerRef = gateway.knownMiners[miner.id];
      expect(minerRef).toEqual(miner);
    });

    it('should check status of existing task if miner is already known', async () => {
      const mockCheckTaskStatus = jest.fn();
      gateway.checkTaskStatus = mockCheckTaskStatus;

      const socket = {};
      let resp = await gateway.handleRegisterMiner(socket as any, net, '0xB24780438dD4DB52848A3A398B1A8A08223aBd83');
      expect(resp).toBeInstanceOf(Object);
      expect(resp).toEqual({
        data: {
          ok: true,
        },
      });

      const miner = gateway.minersQueue[net][0];
      gateway.minerTask[miner.id] = { task, minerId: miner.id, assignedAt: Date.now() / 1000 };

      resp = await gateway.handleRegisterMiner(socket as any, net, '0xB24780438dD4DB52848A3A398B1A8A08223aBd83');
      expect(resp).toEqual({
        data: {
          ok: true,
        },
      });
      expect(mockCheckTaskStatus).toHaveBeenCalledTimes(1);
      expect(mockCheckTaskStatus).toHaveBeenCalledWith(gateway.minerTask[miner.id]);
    });
  });

  describe('.produceTasks', () => {
    let task: MineTask;
    let task2: MineTask;

    beforeEach(async () => {
      task = await MineTask.create({
        type: MineTaskType.Draft,
        orderId: 0,
        network: net,
        marketAddress: '0xMarket',
      });
    });

    it('should fetch uncompleted tasks from database into the queue', async () => {
      task2 = await MineTask.create({
        type: MineTaskType.Undraft,
        orderId: 0,
        network: net,
        marketAddress: '0xMarket',
      });

      await gateway.produceTasks();
      const queuedTask = gateway.queuedTasks[task.id];
      expect(queuedTask).toBeDefined();
      expect(queuedTask.task.id).toEqual(task.id);
      expect(queuedTask.assignedAt).toEqual(0);
      expect(gateway.queue).toHaveLength(2);
      expect([gateway.queue[0].id, gateway.queue[1].id]).toContainEqual(task.id);
      expect([gateway.queue[0].id, gateway.queue[1].id]).toContainEqual(task2.id);
    });

    it('should check the status of task that was already added into the queue', async () => {
      const mockCheckTaskStatus = jest.fn();
      gateway.checkTaskStatus = mockCheckTaskStatus;

      await gateway.produceTasks();
      const queuedTask = gateway.queuedTasks[task.id];
      expect(queuedTask).toBeDefined();

      await gateway.produceTasks();
      expect(mockCheckTaskStatus).toHaveBeenCalledTimes(1);
      expect(mockCheckTaskStatus).toHaveBeenCalledWith(gateway.queuedTasks[task.id]);
    });

    describe('when preferred mine task is set', () => {
      beforeEach(async () => {
        task2 = await MineTask.create({
          type: MineTaskType.Undraft,
          orderId: 0,
          network: net,
          marketAddress: '0xMarket',
        });
      });

      it('should fetch uncompleted tasks matching the specified type=undraft', async () => {
        cfgObj['app.preferredMineTaskType'] = 'undraft';

        await gateway.produceTasks();
        const queuedTask = gateway.queuedTasks[task2.id];
        expect(queuedTask).toBeDefined();
        expect(queuedTask.task.id).toEqual(task2.id);
        expect(queuedTask.assignedAt).toEqual(0);
        expect(gateway.queue).toHaveLength(1);
        expect(gateway.queue[0].id).toEqual(task2.id);
      });

      it('should fetch uncompleted tasks matching the specified type=undraft', async () => {
        cfgObj['app.preferredMineTaskType'] = 'draft';

        await gateway.produceTasks();
        const queuedTask = gateway.queuedTasks[task.id];
        expect(queuedTask).toBeDefined();
        expect(queuedTask.task.id).toEqual(task.id);
        expect(queuedTask.assignedAt).toEqual(0);
        expect(gateway.queue).toHaveLength(1);
        expect(gateway.queue[0].id).toEqual(task.id);
      });
    });
  });

  describe('.assignTask', () => {
    let task: MineTask;

    beforeEach(async () => {
      task = await MineTask.create({
        type: MineTaskType.Draft,
        orderId: 0,
        network: net,
        marketAddress: '0xMarket',
      });
    });

    it('should return `Task queue is empty` if no task is available', async () => {
      const resp = gateway.assignTask();
      expect(resp).toEqual(AssignFuncResult.NO_TASK);
    });

    it('should return `No miner available` if no miner is available and add task back to queue', async () => {
      await gateway.produceTasks();
      const resp = gateway.assignTask();
      expect(resp).toEqual(AssignFuncResult.NO_MINER);
      expect(gateway.queue).toHaveLength(1);
    });

    it('should return `No miner available` if no miner is available and not add task back to queue if task was passed as argument', async () => {
      await gateway.produceTasks();
      const task = gateway.queue[0];
      gateway.queue = [];

      const resp = gateway.assignTask(task);
      expect(resp).toEqual(AssignFuncResult.NO_MINER);
      expect(gateway.queue).toHaveLength(0);
    });

    it('should return `Miner disconnected` when a miner socket disconnected', async () => {
      const mockEmit = jest.fn().mockImplementation((event, task, cb) => {
        cb();
      });

      const socket = { emit: mockEmit, connected: false };
      await gateway.handleRegisterMiner(socket as any, net, '0xB24780438dD4DB52848A3A398B1A8A08223aBd83');
      await gateway.produceTasks();
      const resp = gateway.assignTask();
      expect(resp).toEqual(AssignFuncResult.MINER_DISCONNECTED);
    });

    it('should return `ok` when a miner is found and emit task to miner and update state correctly', async () => {
      const mockEmit = jest.fn().mockImplementation((event, task, cb) => {
        cb();
      });

      const socket = { emit: mockEmit, connected: true };
      await gateway.handleRegisterMiner(socket as any, net, '0xB24780438dD4DB52848A3A398B1A8A08223aBd83');
      await gateway.produceTasks();
      const resp = gateway.assignTask();
      expect(resp).toEqual('ok');

      expect(mockEmit).toBeCalledTimes(1);
      expect(mockEmit).toBeCalledWith('task', task, expect.any(Function));

      const minerId = makeMinerId(net, '0xB24780438dD4DB52848A3A398B1A8A08223aBd83');
      expect(gateway.queuedTasks[task.id].minerId).toEqual(minerId);
      expect(gateway.minerTask[minerId]).toEqual(gateway.queuedTasks[task.id]);
    });

    it('should return Error when emit failed and update state correctly and put task back to queue', async () => {
      const mockEmit = jest.fn().mockImplementation(() => {
        throw new Error('failed to emit');
      });

      const socket = { emit: mockEmit, connected: true };
      await gateway.handleRegisterMiner(socket as any, net, '0xB24780438dD4DB52848A3A398B1A8A08223aBd83');
      await gateway.produceTasks();
      const resp = gateway.assignTask();
      expect(resp).toEqual(new Error('failed to emit'));

      expect(mockEmit).toBeCalledTimes(1);
      expect(mockEmit).toBeCalledWith('task', task, expect.any(Function));

      expect(gateway.minersQueue[net]).toHaveLength(0);
      expect(gateway.knownMiners).toEqual({});
      expect(gateway.queue).toHaveLength(1);
    });

    it('should return Error when emit failed and should not put task back to queue if task was passed as argument', async () => {
      const mockEmit = jest.fn().mockImplementation(() => {
        throw new Error('failed to emit');
      });

      const socket = { emit: mockEmit, connected: true };
      await gateway.handleRegisterMiner(socket as any, net, '0xB24780438dD4DB52848A3A398B1A8A08223aBd83');
      await gateway.produceTasks();
      const task = gateway.queue[0];
      gateway.queue = [];
      const resp = gateway.assignTask(task);
      expect(resp).toEqual(new Error('failed to emit'));

      expect(mockEmit).toBeCalledTimes(1);
      expect(mockEmit).toBeCalledWith('task', task, expect.any(Function));

      expect(gateway.minersQueue[net]).toHaveLength(0);
      expect(gateway.knownMiners).toEqual({});
      expect(gateway.queue).toHaveLength(0);
    });
  });

  describe('.checkTaskStatus', () => {
    it('should wait for miner when task assign time has not passed miner task duration', async () => {
      const task: QueuedTask = {
        task: await MineTask.create({ network: 'ethereum' }),
        assignedAt: Date.now() / 1000,
      };
      const resp = await gateway.checkTaskStatus(task);
      expect(resp).toEqual(CheckStatusFuncResult.WAITING_FOR_MINER);
    });

    it('should delete task from queue index when completed', async () => {
      const task: QueuedTask = {
        task: await MineTask.create({ network: 'ethereum', completed: true }),
        assignedAt: Date.now() / 1000 - minerTaskDuration,
      };
      gateway.queuedTasks[task.task.id] = task;
      const resp = await gateway.checkTaskStatus(task);
      expect(resp).toEqual(CheckStatusFuncResult.OK);
      expect(gateway.queuedTasks).toEqual({});
    });

    it('should unassign task to miner and add miner back to queue when task is completed', async () => {
      const task: QueuedTask = {
        task: await MineTask.create({ network: 'ethereum', completed: true }),
        assignedAt: Date.now() / 1000 - minerTaskDuration,
        minerId: 'miner_123',
      };

      gateway.minerTask[task.minerId] = task;
      gateway.queuedTasks[task.task.id] = task;
      gateway.minersQueue[task.task.network] = [] as any;

      const resp = await gateway.checkTaskStatus(task);
      expect(resp).toEqual(CheckStatusFuncResult.OK);
      expect(gateway.queuedTasks).toEqual({});
      expect(gateway.minerTask).toEqual({});
      expect(gateway.minersQueue[task.task.network]).toHaveLength(1);
    });

    it('should add task back to queue and reassign the task when task is uncompleted', async () => {
      const task: QueuedTask = {
        task: await MineTask.create({ network: 'ethereum', completed: false }),
        assignedAt: Date.now() / 1000 - minerTaskDuration,
        minerId: 'miner_123',
      };

      gateway.minerTask[task.minerId] = task;
      gateway.queuedTasks[task.task.id] = task;
      gateway.minersQueue[task.task.network] = [] as any;
      const mockAssignTask = jest.fn();
      gateway.assignTask = mockAssignTask;

      const resp = await gateway.checkTaskStatus(task);
      expect(resp).toEqual(CheckStatusFuncResult.OK);
      expect(gateway.queuedTasks).toHaveProperty(task.task.id);
      expect(gateway.minerTask).toEqual({});
      expect(gateway.minersQueue[task.task.network]).toHaveLength(1);
      expect(gateway.queue).toHaveLength(1);
      expect(mockAssignTask).toHaveBeenCalledTimes(1);
    });
  });

  describe('.cleanUpMiner', () => {
    it('should remove miner from queue and knownMiners', async () => {
      const minerId = makeMinerId(net, '0xB24780438dD4DB52848A3A398B1A8A08223aBd83');

      const socket = { id: 'socket_123' };
      await gateway.handleRegisterMiner(socket as any, net, '0xB24780438dD4DB52848A3A398B1A8A08223aBd83');
      expect(gateway.minersQueue[net]).toHaveLength(1);
      expect(gateway.knownMiners).toHaveProperty(minerId);

      gateway.minerTask[minerId] = { minerId } as any;
      await gateway.cleanUpMiner(socket.id);
      expect(gateway.knownMiners).toEqual({});
      expect(gateway.minerTask).toEqual({});
    });
  });
});
