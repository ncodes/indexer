import * as moment from 'moment';
import { DBService } from '../db/db.service';
import OnlineStatus from './online_status';

describe('OnlineStatus', () => {
  const db = DBService.getForTest();
  const net = 'net1';

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.truncateTables();
  });

  describe('.isOnline', () => {
    it('should return correct value', async () => {
      await expect(OnlineStatus.isOnline(net, '0xUser', undefined, undefined, 20)).resolves.toBeFalsy();

      await OnlineStatus.create({
        network: net,
        address: '0xUser',
        updatedAt: moment().subtract(21, 'second').toISOString(),
      });
      await expect(OnlineStatus.isOnline(net, '0xUser', undefined, undefined, 20)).resolves.toBeFalsy();

      await OnlineStatus.create({
        network: net,
        address: '0xUser',
        updatedAt: moment().subtract(20, 'second').toISOString(),
      });
      await expect(OnlineStatus.isOnline(net, '0xUser', undefined, undefined, 20)).resolves.toBeTruthy();

      await OnlineStatus.create({
        network: net,
        address: '0xUser2',
        updatedAt: moment().subtract(20, 'second').toISOString(),
      });
      await OnlineStatus.create({
        network: net,
        address: '0xUser2',
        updatedAt: moment().subtract(21, 'second').toISOString(),
        orderId: 1,
        offerId: 1,
      });
      await expect(OnlineStatus.isOnline(net, '0xUser2', undefined, undefined, 20)).resolves.toBeTruthy();
      await expect(OnlineStatus.isOnline(net, '0xUser2', 1, undefined, 20)).resolves.toBeFalsy();
      await expect(OnlineStatus.isOnline(net, '0xUser2', undefined, 1, 20)).resolves.toBeFalsy();
      await expect(OnlineStatus.isOnline(net, '0xUser2', 1, 1, 20)).resolves.toBeFalsy();
    });
  });
});
