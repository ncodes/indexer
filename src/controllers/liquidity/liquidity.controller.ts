import { Controller, Get, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { ok } from '../../common/responses/responses';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import Liquidity from '../../models/liquidity';
import { LiquidityService } from './liquidity.service';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { ListQueryDTO } from './query.dto';
import { ConfigService } from '../config.service';

@Controller('v1/liquidities')
@UseGuards(BeAuthenticatedGuard)
@UseGuards(HasKeyGuard)
export class LiquidityController {
  constructor(private liqSrv: LiquidityService, private cfgSrv: ConfigService) {}

  /**
   * List liquidities on a network
   * @param q The query object
   *  - [network] The network name.
   *  - [marketId] The market ID (optional)
   *  - [provider] The provider address (optional)
   *  - [noMerge] Prevent merge of contract liquidity with DB liquidity object
   *  - [count] Returns the count of matching result
   *  - [limit] The number of result to return (optional)
   *  - [offset] The query offset (optional)
   *  - [select] Select extend fields to return
   * @returns
   */
  @Get()
  async list(@Query(new ValidationPipe(ValPipeOpt)) q: ListQueryDTO) {
    if (!q.count) {
      const liquidities = await Liquidity.search(
        q.net,
        q.marketId,
        q.provider,
        parseInt(this.cfgSrv.getContractParam(q.net, 'maxOpenDisputes')),
        q.limit || 25,
        q.offset,
        q.select,
      );
      for (const liquidity of liquidities) {
        await this.liqSrv.extendLiquidity(liquidity, q.noMerge, q.select);
      }
      return ok().data(liquidities).build();
    } else {
      return ok()
        .data({
          count: await Liquidity.countLiquidities(
            q.net,
            q.marketId,
            q.provider,
            parseInt(this.cfgSrv.getContractParam(q.net, 'maxOpenDisputes')),
          ),
        })
        .build();
    }
  }
}
