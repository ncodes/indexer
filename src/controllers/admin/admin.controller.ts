import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ok, throw404 } from '../../common/responses/responses';
import NetworkService from '../../network/network.service';
import { IsRootAdmin } from '../../guards/is_basic_admin';

@Controller('v1/admin')
export class AdminController {
  constructor(private readonly netSrv: NetworkService) {}

  /**
   * Force an indexer to index a block
   * @param indexer The indexer name
   * @param blockNumber The block number
   */
  @UseGuards(IsRootAdmin)
  @Post('force-index-block/:indexer/:blockNumber')
  async forceIndexBlock(@Param('indexer') indexer: string, @Param('blockNumber') blockNumber: string) {
    const watcher = this.netSrv.getWatcher(indexer);
    if (!watcher) throw404('watcher was not found');
    watcher.addToPriorityPendingBlocks(parseInt(blockNumber));
    return ok().data({ ok: true }).build();
  }
}
