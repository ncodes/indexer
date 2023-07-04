import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { ListQueryDTO } from './query.dto';
import { ok } from '../../common/responses/responses';
import MineTask from '../../models/mine_task';

@Controller('v1/tasks')
export class TasksController {
  /**
   * List uncompleted tasks
   * @param q The query object
   * @param q.net The network name.
   * @param q.type The type of task (optional)
   * @param [q.count] Returns the count of matching result
   * @param [q.limit] The number of result to return (optional)
   * @param [q.offset] The query offset (optional)
   * @returns
   */
  @Get()
  async list(@Query(new ValidationPipe(ValPipeOpt)) q: ListQueryDTO) {
    if (!q.count) {
      const tasks = await MineTask.searchTasks(q.net, q.type, Math.min(q.limit || 25, 100), q.offset);
      return ok().data(tasks).build();
    } else {
      return ok()
        .data({ count: await MineTask.countTasks(q.net, q.type) })
        .build();
    }
  }
}
