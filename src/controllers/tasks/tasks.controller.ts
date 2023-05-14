import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { ListQueryDTO } from './query.dto';
import { ok } from '../../common/responses/responses';
import MineTask, { MineTaskType } from '../../models/mine_task';
import * as moment from 'moment';
import AssetRegistry from '../../models/asset_registry';

@Controller('v1/tasks')
export class TasksController {
  /**
   * List uncompleted tasks
   * @param q The query object
   *  - [net] The network name.
   *  - [type] The type of task (optional)
   *  - [count] Returns the count of matching result
   *  - [limit] The number of result to return (optional)
   *  - [offset] The query offset (optional)
   * @returns
   */
  @Get()
  async list(@Query(new ValidationPipe(ValPipeOpt)) q: ListQueryDTO) {
    if (!q.count) {
      const tasks = await MineTask.searchTasks(q.net, q.type, q.limit || 25, q.offset);

      // If type=FeeTransfer and no tasks for it, create a task for each
      // shareable asset. This type of task can be executed immediately
      // for assets newly registered as shareable
      if (q.type === MineTaskType.FeeTransfer && !tasks.length) {
        const sharables = await AssetRegistry.getSharedAssets(q.net);
        if (sharables && sharables.length) {
          sharables.forEach((address) => {
            tasks.push(
              new MineTask({
                type: MineTaskType.FeeTransfer,
                network: q.net,
                transferredToken: address,
                mineAt: moment().toISOString(),
              }),
            );
          });
        }
      }

      return ok().data(tasks).build();
    } else {
      return ok()
        .data({ count: await MineTask.countTasks(q.net, q.type) })
        .build();
    }
  }
}
