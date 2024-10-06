import { getPaymentMethod } from '@jointlabs/meta';
import { Body, Controller, Get, Param, Put, Query, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { isNumberString } from 'class-validator';
import { Request } from 'express';
import { CommonValidationPipeOpt } from '../../common/pipes/common.pipe';
import { ok, throw400, throw404 } from '../../common/responses/responses';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import PayRouterOrg from '../../models/pay_router_org';
import PayRouterRequester from '../../models/pay_router_requester';
import PayRouterRoute from '../../models/pay_router_route';
import PaymentMethod from '../../models/payment_method';
import { GetQueryDTO, GetRoutesParamsDTO, UpdateFeeDTO, UpdatePaymentMethodDTO } from './query.dto';

@Controller('v1/routes')
export class RoutesController {
  /**
   * Get routes for a given network, region, and destination organization ID.
   * @param region - The region to get routes for.
   * @param destOrgId - The destination organization ID. This is the numeric ID as found in @jointlabs/meta. It
   * can also access the string ID of an indexed org in the database and will resolve to the intended numeric org ID.
   * @param q - The query object
   * @returns
   */
  @Get('/:region/:destOrgId')
  async getRoutes(
    @Req() req: Request,
    @Query(new ValidationPipe(CommonValidationPipeOpt)) q: GetQueryDTO,
    @Param(new ValidationPipe(CommonValidationPipeOpt)) params: GetRoutesParamsDTO,
  ) {
    // Find the requester if provided. If the requester exists, we'll only
    // return routes that have approved the requester.
    const requester = q.requester ? await PayRouterRequester.findByNetworkAndAddress(q.net, q.requester) : undefined;
    if (q.requester && !requester) throw404('requester not found');

    // If the destination org ID is not a number, we assume it's a string ID
    // and attempt to resolve it by looking up the org ID in the database
    // and using the numeric ID for the rest of the query. Otherwise, we use the numeric ID.
    let destOrgId = 0;
    if (!isNumberString(params.destOrgId)) {
      const destOrg = await PayRouterOrg.getById(params.destOrgId);
      if (!destOrg) throw404('Destination organization not found');
      destOrgId = destOrg.orgId;
    } else {
      destOrgId = parseInt(params.destOrgId);
    }

    // If the region is not provided, we use the region from the
    // request headers provided by Cloudflare.
    let region = params.region;
    region = region == '-' ? (req.headers['cf-ipcountry'] as string) : region;

    // If the max depth is not provided, we use a default of 5.
    // This will limit the number of connecting routes to 5.
    const maxDepth = Math.min(q.maxDepth || 5, 5);

    // Select the fields we need from the routes and payment methods.
    // Query for routes that match the network, destination org ID, and minimum bond.
    const select = ['id', 'sourceOrgId', 'destOrgId', 'bond', 'owner', 'fee', 'routeId'];
    const pmSelect = ['id', 'name', 'type', 'accountId'];
    const routes = await PayRouterRoute.findByNetworkAndDestination(
      q.net,
      destOrgId,
      q.minBond,
      requester?.id,
      select,
      pmSelect,
    );

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
          const routes = await PayRouterRoute.findByNetworkAndDestination(
            q.net,
            route.sourceOrgId,
            q.minBond,
            requester?.id,
            select,
          );
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
    let selectedRoutes = await findPaths(routes, destOrgId);
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
