import { HttpException, INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AllExceptionsFilter } from '../../common/interceptors/exception_filter';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/DBService';
import MineTask, { MineTaskType } from '../../models/mine_task';
import { SupportedNetworks } from '../../network/common';
import { TasksGateway, makeMinerId } from './tasks.gateway';

describe('TaskGateway', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let gateway: TasksGateway;
  const net = SupportedNetworks.Ethereum;

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

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({})],
      providers: [TasksGateway],
    }).compile();
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
      gateway.minerTask[miner.id] = { task, minerId: miner.id, queuedAt: Date.now() / 1000 };

      resp = await gateway.handleRegisterMiner(socket as any, net, '0xB24780438dD4DB52848A3A398B1A8A08223aBd83');
      expect(resp).toEqual({
        data: {
          ok: true,
        },
      });
      expect(mockCheckTaskStatus).toHaveBeenCalledTimes(1);
      expect(mockCheckTaskStatus).toHaveBeenCalledWith(gateway.minerTask[miner.id]);
    });

    it('should disconnect and replace old socket if miner is already known', async () => {
      const mockCheckTaskStatus = jest.fn();
      gateway.checkTaskStatus = mockCheckTaskStatus;

      const mockDisconnect = jest.fn();
      const socket = { disconnect: mockDisconnect };
      let resp = await gateway.handleRegisterMiner(socket as any, net, '0xB24780438dD4DB52848A3A398B1A8A08223aBd83');
      expect(resp).toBeInstanceOf(Object);
      expect(resp).toEqual({
        data: {
          ok: true,
        },
      });

      const miner = gateway.minersQueue[net][0];
      gateway.minerTask[miner.id] = { task, minerId: miner.id, queuedAt: Date.now() / 1000 };

      const socket2 = { id: 'xyz' };
      resp = await gateway.handleRegisterMiner(socket2 as any, net, '0xB24780438dD4DB52848A3A398B1A8A08223aBd83');
      expect(resp).toEqual({
        data: {
          ok: true,
        },
      });
      expect(gateway.knownMiners[miner.id].socket).toEqual(socket2);
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
      expect(mockCheckTaskStatus).toHaveBeenCalledTimes(1);
      expect(mockCheckTaskStatus).toHaveBeenCalledWith(gateway.minerTask[miner.id]);
    });
  });

  describe('.produceTasks', () => {
    let task: MineTask;

    beforeEach(async () => {
      task = await MineTask.create({
        type: MineTaskType.Draft,
        orderId: 0,
        network: net,
        marketAddress: '0xMarket',
      });
    });

    it('should fetch uncompleted tasks from database into the queue', async () => {
      await gateway.produceTasks();
      const queuedTask = gateway.queuedTasks[task.id];
      expect(queuedTask).toBeDefined();
      expect(queuedTask.task.id).toEqual(task.id);
      expect(queuedTask.queuedAt).toBeCloseTo(Date.now() / 1000, 0);
      expect(gateway.queue).toHaveLength(1);
      expect(gateway.queue[0].id).toEqual(task.id);
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

    it('should return `No task available` if no task is available', async () => {
      const resp = gateway.assignTask();
      expect(resp).toEqual('No task available');
    });

    it('should return `No miner available` if no miner is available and add task back to queue', async () => {
      await gateway.produceTasks();
      const resp = gateway.assignTask();
      expect(resp).toEqual('No miner available');
      expect(gateway.queue).toHaveLength(1);
    });

    it('should return `No miner available` if no miner is available and not add task back to queue if task was passed as argument', async () => {
      await gateway.produceTasks();
      const task = gateway.queue[0];
      gateway.queue = [];

      const resp = gateway.assignTask(task);
      expect(resp).toEqual('No miner available');
      expect(gateway.queue).toHaveLength(0);
    });

    it('should return `ok` when a miner is found and emit task to miner and update state correctly', async () => {
      const mockEmit = jest.fn().mockImplementation((event, task, cb) => {
        cb();
      });

      const socket = { emit: mockEmit };
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

      const socket = { emit: mockEmit };
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

      const socket = { emit: mockEmit };
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
});
