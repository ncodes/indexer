import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import { ok } from '../../common/responses/responses';
import Liquidity from '../../models/liquidity';
import { LiquidityService } from './liquidity.service';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { ListQueryDTO } from './query.dto';
import { ConfigService } from '../../config/config.service';

@Controller('v1/liquidities')
export class LiquidityController {
  constructor(private liqSrv: LiquidityService, private cfgSrv: ConfigService) {}

  /**
   * List liquidities on a network
   * @param q The query object
   * @param q.network The network name.
   * @param [q.marketAddress] The market ID
   * @param [q.amount] Limit result to liquidity where amount is between their swap amount limit
   * @param [q.provider] The provider address
   * @param [q.count] Returns the count of matching result
   * @param [q.limit] The number of result to return
   * @param [q.offset] The query offset
   * @param [q.select] Select extend fields to return
   * @returns
   */
  @Get()
  async list(@Query(new ValidationPipe(ValPipeOpt)) q: ListQueryDTO) {
    const maxOpenDisputes = parseInt(await this.cfgSrv.getContractParam(q.net, 'maxOpenDisputes'));
    if (!q.count) {
      const liquidities = await Liquidity.search(
        q.net,
        q.marketAddress,
        q.provider,
        maxOpenDisputes,
        q.amount,
        q.limit || 25,
        q.offset,
        q.select,
        undefined,
      );
      for (const liquidity of liquidities) {
        await this.liqSrv.extendLiquidity(liquidity, q.select);
      }
      return ok().data(liquidities).build();
    } else {
      return ok()
        .data({
          count: await Liquidity.countLiquidities(q.net, q.marketAddress, q.provider, maxOpenDisputes),
        })
        .build();
    }
  }
}
