import { getPaymentMethod } from '@jointlabs/meta';
import { Body, Controller, Get, Param, Put, Query, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { CommonValidationPipeOpt } from '../../common/pipes/common.pipe';
import { ok, throw400, throw404 } from '../../common/responses/responses';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import PayRouterRoute from '../../models/pay_router_route';
import PaymentMethod from '../../models/payment_method';
import { GetQueryDTO, UpdateFeeDTO, UpdatePaymentMethodDTO } from './query.dto';

@Controller('v1/routes')
export class RoutesController {
  constructor(private cfgSrv: ConfigService) {}

  /**
   * Get routes for a given network, region, and destination organization ID.
   * @param region - The region to get routes for.
   * @param destOrgId - The destination organization ID
   * @param q - The query object
   * @returns
   */
  @Get('/:region/:destOrgId')
  async getRoutes(
    @Req() req: Request,
    @Query(new ValidationPipe(CommonValidationPipeOpt)) q: GetQueryDTO,
    @Param('region') region: string,
    @Param('destOrgId') destOrgId: string,
  ) {
    region = region == '-' ? (req.headers['cf-ipcountry'] as string) : region;
    const maxDepth = Math.min(q.maxDepth || 5, 5);

    const select = ['id', 'sourceOrgId', 'destOrgId', 'bond', 'owner', 'fee', 'routeId'];
    const pmSelect = ['id', 'name', 'type', 'accountId'];
    const _destOrgId = parseInt(destOrgId);
    const routes = await PayRouterRoute.findByNetworkAndDestination(q.net, _destOrgId, q.minBond, select, pmSelect);

    const findPaths = async (
      routes: PayRouterRoute[],
      destOrgId: number,
      currentPath: PayRouterRoute[] = [],
      visited = new Set<number>(),
    ) => {
      const selectedRoutes: PayRouterRoute[][] = [];
      let paths: PayRouterRoute[] = [];

      if (visited.has(destOrgId)) return [];
      visited.add(destOrgId);

      for (const route of routes) {
        if (route.destOrgId != destOrgId) continue;

        const routePayMethodInfo = getPaymentMethod(route.sourceOrg.name);
        if (!routePayMethodInfo) continue;

        // Add route to path if it supports the target region
        if (routePayMethodInfo.regions.includes(region)) {
          selectedRoutes.push([route, ...currentPath]);
        } else {
          paths.push(route);
          const routes = await PayRouterRoute.findByNetworkAndDestination(q.net, route.sourceOrgId, q.minBond, select);
          const newPaths = await findPaths(routes, route.sourceOrgId, [...paths, ...currentPath], new Set(visited));
          selectedRoutes.push(...newPaths);
          paths = [];
        }
      }

      return selectedRoutes;
    };

    // Get eligible routes.
    // Remove routes greater than max depth.
    // Sort by shortest path.
    let selectedRoutes = await findPaths(routes, _destOrgId);
    selectedRoutes = selectedRoutes.filter((path) => path.length <= maxDepth);
    selectedRoutes.sort((a, b) => a.length - b.length);

    return ok().data(selectedRoutes).build();
  }

  /**
   * Update the payment method for a given route
   * @param req The request object
   * @param id The route ID
   * @param body The body object
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Put('/:id/payment-method')
  async updatePaymentMethod(
    @Req() req: Request,
    @Param('id') id: string,
    @Body(new ValidationPipe(CommonValidationPipeOpt)) body: UpdatePaymentMethodDTO,
  ) {
    let route = await PayRouterRoute.getByIdAndOwner(id, req.user.address);
    if (!route) throw404('Route not found');

    const pm = await PaymentMethod.getById(body.paymentMethodId, 'org');
    if (!pm || pm.userId != req.user.id) throw404('Payment method not found');

    if (pm.org.orgId != route.sourceOrgId) throw400('Payment method org must match route source org');

    route = await PayRouterRoute.updateById(id, { paymentMethodId: body.paymentMethodId });
    return ok().data(route).build();
  }

  /**
   * Update the fee for a given route
   * @param req The request object
   * @param id The route ID
   * @param body The body object
   * @returns
   */
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  @Put('/:id/fee')
  async updateFee(
    @Req() req: Request,
    @Param('id') id: string,
    @Body(new ValidationPipe(CommonValidationPipeOpt)) body: UpdateFeeDTO,
  ) {
    let route = await PayRouterRoute.getByIdAndOwner(id, req.user.address);
    if (!route) throw404('Route not found');
    route = await PayRouterRoute.updateById(route.id, { fee: body.fee });
    return ok().data(route).build();
  }
}
