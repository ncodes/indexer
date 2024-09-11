import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import Meta, { MetaKeys } from '../../models/meta';
import PayRouterBondTransfer from '../../models/pay_router_bond_transfer';
import PayRouterOrg from '../../models/pay_router_org';
import PayRouterRequest from '../../models/pay_router_request';
import PayRouterRequestPayment from '../../models/pay_router_request_payment';
import PayRouterRequester from '../../models/pay_router_requester';
import PayRouterRoute from '../../models/pay_router_route';
import PayRouterRouteRequester from '../../models/pay_router_route_requester';
import PayRouterSourceTransfer from '../../models/pay_router_source_transfer';
import { PayRouterHandler } from './pay_router.handler';

const MockNetworkService = jest.fn().mockImplementation(() => {
  return {};
});

describe.only('PayRouterHandler', () => {
  const db = DBService.getForTest();
  const net = 'ethereum';
  const user = '0xUser';
  let handler: PayRouterHandler;
  const contracts = {};
  const cfg = {};

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await db.truncateTables();

    jest.clearAllMocks();
    handler = new PayRouterHandler(new MockNetworkService(), net, contracts);
    handler.logger = new NoopLogger() as any;
    handler.getParam = (param) => {
      return cfg[param];
    };

    await Meta.create(
      Meta.makeNetKey(net, MetaKeys.ContractsParams),
      JSON.stringify({
        payRouterProtocolFeeBp: 1000,
      }),
    );
  });

  describe('.onParameterUpdate', function () {
    it('should update contract params correctly', async () => {
      await expect(handler.onParameterUpdate('evidenceDur', '1', {} as any)).resolves.toBeUndefined();
      const value = await Meta.getContractParam(net, 'evidenceDur');
      expect(value).toEqual('1');
    });
  });

  describe('.onUpdatedRequesterFeeBp', function () {
    it('should update requester fee bp correctly', async () => {
      let requester = await PayRouterRequester.findByNetworkAndAddress(net, user);
      expect(requester).toBeUndefined();

      await expect(handler.onUpdatedRequesterFeeBp(user, BigInt(10), {} as any)).resolves.toBeUndefined();
      requester = await PayRouterRequester.findByNetworkAndAddress(net, user);
      expect(requester.feeBp).toEqual(10);

      await expect(handler.onUpdatedRequesterFeeBp(user, BigInt(12), {} as any)).resolves.toBeUndefined();
      requester = await PayRouterRequester.findByNetworkAndAddress(net, user);
      expect(requester.feeBp).toEqual(12);
    });
  });

  describe('.onUpdatedRequesterValueLockDur', function () {
    it('should update requester value lock duration correctly', async () => {
      let requester = await PayRouterRequester.findByNetworkAndAddress(net, user);
      expect(requester).toBeUndefined();

      await expect(handler.onUpdatedRequesterValueLockDur(user, BigInt(300), {} as any)).resolves.toBeUndefined();
      requester = await PayRouterRequester.findByNetworkAndAddress(net, user);
      expect(requester.valueLockDur).toEqual(300);

      await expect(handler.onUpdatedRequesterValueLockDur(user, BigInt(100), {} as any)).resolves.toBeUndefined();
      requester = await PayRouterRequester.findByNetworkAndAddress(net, user);
      expect(requester.valueLockDur).toEqual(100);
    });
  });

  describe('.onRouteCreated', function () {
    it('should create a new route', async () => {
      await expect(
        handler.onRouteCreated(BigInt(1), user, BigInt(1), '0xToken', BigInt(1), BigInt(2), BigInt(100), {} as any),
      ).resolves.toBeUndefined();
      const route = await PayRouterRoute.findByNetworkAndRouteId(net, 1);
      expect(route).toBeDefined();
      expect(route.owner).toEqual(user);
      expect(route.source).toEqual(1);
      expect(route.sourceToken).toEqual('0xToken');
      expect(route.sourceOrgId).toEqual(1);
      expect(route.destOrgId).toEqual(2);
      expect(route.bond).toEqual('100');
    });
  });

  describe('.onOrgCreated', function () {
    it('should create a new organization', async () => {
      await expect(handler.onOrgCreated(user, 'Org1', BigInt(1), {} as any)).resolves.toBeUndefined();
      const org = await PayRouterOrg.findByNetworkAndOrgId(net, 1);
      expect(org).toBeDefined();
      expect(org.creator).toEqual(user);
      expect(org.name).toEqual('Org1');
      expect(org.orgId).toEqual(1);
    });
  });

  describe('.onApprovedRequester', function () {
    it('should create a new route requester record', async () => {
      const route = await PayRouterRoute.create({ network: net, routeId: 1 });
      await expect(handler.onApprovedRequester(BigInt(1), user, {} as any)).resolves.toBeUndefined();
      const requester = await PayRouterRequester.findByNetworkAndAddress(net, user);
      expect(requester).toBeDefined();
      const routeRequester = await PayRouterRouteRequester.findByNetworkAndRouteIdAndRequesterId(
        net,
        route.id,
        requester.id,
      );
      expect(routeRequester).toBeDefined();
    });

    describe('when requester already exists', () => {
      it('should not create a new route requester record', async () => {
        const route = await PayRouterRoute.create({ network: net, routeId: 1 });
        const requester = await PayRouterRequester.create({ network: net, address: user });

        await expect(handler.onApprovedRequester(BigInt(1), user, {} as any)).resolves.toBeUndefined();
        const res = await PayRouterRequester.findByNetworkAndAddress(net, user);
        expect(res).toBeDefined();
        expect(res.id).toEqual(requester.id);

        const routeRequester = await PayRouterRouteRequester.findByNetworkAndRouteIdAndRequesterId(
          net,
          route.id,
          requester.id,
        );
        expect(routeRequester).toBeDefined();
      });
    });
  });

  describe('.onUnapprovedRequester', function () {
    it('should delete a route requester record', async () => {
      const route = await PayRouterRoute.create({ network: net, routeId: 1 });
      const requester = await PayRouterRequester.create({ network: net, address: user });
      const routeRequester = await PayRouterRouteRequester.create({
        network: net,
        routeId: route.id,
        requesterId: requester.id,
      });
      await expect(handler.onUnapprovedRequester(BigInt(1), user, {} as any)).resolves.toBeUndefined();
      const res = await PayRouterRequester.findByNetworkAndAddress(net, user);
      expect(res).toBeDefined();
    });
  });

  describe('.onDepositedBond', function () {
    it('should update the bond amount', async () => {
      const route = await PayRouterRoute.create({ network: net, routeId: 1 });
      await expect(handler.onDepositedBond(user, BigInt(1), BigInt(100), {} as any)).resolves.toBeUndefined();
      let res = await PayRouterRoute.findByNetworkAndRouteId(net, 1);
      expect(res).toBeDefined();
      expect(res.bond).toEqual('100');

      await expect(handler.onDepositedBond(user, BigInt(1), BigInt(100), {} as any)).resolves.toBeUndefined();
      res = await PayRouterRoute.findByNetworkAndRouteId(net, 1);
      expect(res).toBeDefined();
      expect(res.bond).toEqual('200');
    });
  });

  describe('.onWithdrawnBond', function () {
    it('should update the bond amount', async () => {
      const route = await PayRouterRoute.create({ network: net, routeId: 1, bond: '100' });
      await expect(
        handler.onWithdrawnBond(user, BigInt(route.routeId), BigInt(50), {} as any),
      ).resolves.toBeUndefined();
      let res = await PayRouterRoute.findByNetworkAndRouteId(net, 1);
      expect(res).toBeDefined();
      expect(res.bond).toEqual('50');
    });
  });

  describe('.onRequestCreated', function () {
    it('should create a new request', async () => {
      await PayRouterRoute.create({ network: net, routeId: 1, bond: '100' });
      await PayRouterRoute.create({ network: net, routeId: 2, bond: '100' });

      await expect(
        handler.onRequestCreated(
          user,
          BigInt(1),
          [BigInt(1), BigInt(2)],
          [BigInt(10), BigInt(11)],
          BigInt(100),
          {} as any,
        ),
      ).resolves.toBeUndefined();

      const request = await PayRouterRequest.findByNetworkAndRequestId(net, 1);
      expect(request).toBeDefined();
      expect(request.creator).toEqual(user);
      expect(request.requestId).toEqual(1);
      expect(request.requesterFeeBp).toEqual(0);
      expect(request.valueLockDuration).toEqual(0);
      expect(request.protocolFeeBp).toEqual(1000);
      expect(request.sourceAmt).toEqual('100');

      const route1 = await PayRouterRoute.findByNetworkAndRouteId(net, 1);
      expect(route1.bond).toEqual('90');

      const route2 = await PayRouterRoute.findByNetworkAndRouteId(net, 2);
      expect(route2).toBeDefined();
      expect(route2.bond).toEqual('89');
    });

    describe('when requester already exists', () => {
      it('should not create a new request', async () => {
        await PayRouterRoute.create({ network: net, routeId: 1, bond: '100' });
        await PayRouterRoute.create({ network: net, routeId: 2, bond: '100' });

        const requester = await PayRouterRequester.create({
          network: net,
          address: user,
          feeBp: 1000,
          valueLockDur: 100,
        });

        await expect(
          handler.onRequestCreated(
            user,
            BigInt(1),
            [BigInt(1), BigInt(2)],
            [BigInt(10), BigInt(11)],
            BigInt(100),
            {} as any,
          ),
        ).resolves.toBeUndefined();

        const res = await PayRouterRequest.findByNetworkAndRequestId(net, 1);
        expect(res).toBeDefined();
        expect(res.creator).toEqual(user);
        expect(res.valueLockDuration).toEqual(requester.valueLockDur);
        expect(res.protocolFeeBp).toEqual(requester.feeBp);
      });
    });
  });

  describe('.onOrgSourcePaid', function () {
    it('should update the request status', async () => {
      const request = await PayRouterRequest.create({ network: net, requestId: 1 });
      await expect(handler.onOrgSourcePaid(BigInt(request.requestId), {} as any)).resolves.toBeUndefined();
      const res = await PayRouterRequest.findByNetworkAndRequestId(net, 1);
      expect(res).toBeDefined();
      expect(res.orgSourcePaid).toEqual(true);
    });
  });

  describe('.onRequestPaid', function () {
    it('should create a new request payment record', async () => {
      const request = await PayRouterRequest.create({ network: net, requestId: 1 });
      const route = await PayRouterRoute.create({ network: net, routeId: 1 });

      await expect(
        handler.onRequestPaid(user, BigInt(request.requestId), BigInt(route.routeId), BigInt(100), {} as any),
      ).resolves.toBeUndefined();

      const res = await PayRouterRequestPayment.findByNetworkRequestIdAndRouteId(net, request.id, route.id);
      expect(res).toBeDefined();
      expect(res.bond).toEqual('100');
      expect(res.payer).toEqual(user);
      expect(res.requestId).toEqual(request.id);
      expect(res.routeId).toEqual(route.id);

      await expect(
        handler.onRequestPaid(user, BigInt(request.requestId), BigInt(route.routeId), BigInt(100), {} as any),
      ).resolves.toBeUndefined();

      const recs = await PayRouterRequestPayment.findAllByNetworkAndRouteId(net, route.id);
      expect(recs.length).toEqual(1);
    });
  });

  describe('.onBondReturned', function () {
    it('should update the bond amount', async () => {
      const route = await PayRouterRoute.create({ network: net, routeId: 1, bond: '100' });
      await expect(handler.onBondReturned(user, BigInt(route.routeId), BigInt(50), {} as any)).resolves.toBeUndefined();
      const res = await PayRouterRoute.findByNetworkAndRouteId(net, 1);
      expect(res).toBeDefined();
      expect(res.bond).toEqual('150');
    });
  });

  describe('.onRequestClosed', function () {
    it('should update the request status', async () => {
      const request = await PayRouterRequest.create({ network: net, requestId: 1 });
      await expect(handler.onRequestClosed(BigInt(request.requestId), {} as any)).resolves.toBeUndefined();
      const res = await PayRouterRequest.findByNetworkAndRequestId(net, 1);
      expect(res).toBeDefined();
      expect(res.closed).toEqual(true);
    });
  });

  describe('.onRequestCancelled', function () {
    it('should update the request status', async () => {
      const request = await PayRouterRequest.create({ network: net, requestId: 1 });
      await expect(handler.onRequestCancelled(BigInt(request.requestId), {} as any)).resolves.toBeUndefined();
      const res = await PayRouterRequest.findByNetworkAndRequestId(net, 1);
      expect(res).toBeDefined();
      expect(res.cancelled).toEqual(true);
    });
  });

  describe('.onBondTransferred', function () {
    it('should create a new bond transfer record', async () => {
      const request = await PayRouterRequest.create({ network: net, requestId: 1 });
      const route = await PayRouterRoute.create({ network: net, routeId: 1 });

      await expect(
        handler.onBondTransferred(BigInt(request.requestId), BigInt(route.routeId), BigInt(100), user, {} as any),
      ).resolves.toBeUndefined();

      let res = await PayRouterBondTransfer.findByNetworkRequestIdAndRouteId(net, request.id, route.id);
      expect(res).toHaveLength(1);
      expect(res[0].amount).toEqual('100');
      expect(res[0].beneficiary).toEqual(user);
      expect(res[0].requestId).toEqual(request.id);
      expect(res[0].routeId).toEqual(route.id);

      await expect(
        handler.onBondTransferred(BigInt(request.requestId), BigInt(route.routeId), BigInt(100), user, {} as any),
      ).resolves.toBeUndefined();

      res = await PayRouterBondTransfer.findByNetworkRequestIdAndRouteId(net, request.id, route.id);
      expect(res).toHaveLength(2);
    });
  });

  describe('.onSourceTransferred', function () {
    it('should create a new source transfer record', async () => {
      const request = await PayRouterRequest.create({ network: net, requestId: 1 });

      await expect(
        handler.onSourceTransferred(BigInt(request.requestId), BigInt(100), user, {} as any),
      ).resolves.toBeUndefined();

      let res = await PayRouterSourceTransfer.findByNetworkRequestIdAndBeneficiary(net, request.id, user);
      expect(res).toHaveLength(1);
      expect(res[0].amount).toEqual('100');
      expect(res[0].beneficiary).toEqual(user);
      expect(res[0].requestId).toEqual(request.id);

      await expect(
        handler.onSourceTransferred(BigInt(request.requestId), BigInt(100), user, {} as any),
      ).resolves.toBeUndefined();

      res = await PayRouterSourceTransfer.findByNetworkRequestIdAndBeneficiary(net, request.id, user);
      expect(res).toHaveLength(2);
    });
  });
});
