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
   * @param [q.market] The market ID
   * @param [q.amount] Filter by minimum swap amount (if it starts with '>', it means equal or greater than or if it starts with '<', it means equal or less than)
   * @param [q.price] Filter by price (if it starts with '>', it means equal or greater than or if it starts with '<', it means equal or less than)
   * @param [q.kycLp] Indicate to only return liquidity where LPs has KYC badge
   * @param [q.kycTaker] Indicate to only return liquidity where taker has KYC badge
   * @param [q.swapBadge] Indicate to only return liquidity where taker has the specified badge(s)
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

    const reqLpBadges = [];
    if (q.kycLp) {
      reqLpBadges.push(this.cfgSrv.get('app.badges.kyc'));
      reqLpBadges.push(this.cfgSrv.get('app.badges.kyc') + '/%');
    }

    const reqSwapBadges = [];
    if (q.kycTaker) {
      reqSwapBadges.push(this.cfgSrv.get('app.badges.kyc'));
      reqSwapBadges.push(this.cfgSrv.get('app.badges.kyc') + '/%');
    }

    if (q.swapBadges) {
      reqSwapBadges.push(...q.swapBadges);
    }

    if (!q.count) {
      const liquidities = await Liquidity.search(
        q.net,
        q.market,
        q.provider,
        maxOpenDisputes,
        q.amount,
        q.price,
        reqLpBadges,
        reqSwapBadges,
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
          count: await Liquidity.countLiquidities(q.net, q.market, q.provider, maxOpenDisputes),
        })
        .build();
    }
  }
}
