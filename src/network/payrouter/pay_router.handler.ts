import { Provider } from 'ethers';
import { Transaction } from 'objection';
import { toDec } from '../../common/common';
import Meta from '../../models/meta';
import PayRouterBondTransfer from '../../models/pay_router_bond_transfer';
import PayRouterOrg from '../../models/pay_router_org';
import PayRouterRequest from '../../models/pay_router_request';
import PayRouterRequestPayment from '../../models/pay_router_request_payment';
import PayRouterRequester from '../../models/pay_router_requester';
import PayRouterRoute from '../../models/pay_router_route';
import PayRouterRouteRequester from '../../models/pay_router_route_requester';
import PayRouterSourceTransfer from '../../models/pay_router_source_transfer';
import { ContractCallEvent } from '../common';
import { Handler } from '../handler';

export class PayRouterHandler extends Handler {
  constructor(private provider: Provider, public network: string, private contracts: JointContracts) {
    super(PayRouterHandler.name, null, network, contracts.payRouter);
  }

  /**
   * Listen for events
   */
  listen() {
    this.on('UpdatedProtocolFeeBp', async (feeBp: bigint, event: ContractCallEvent, txn?: Transaction) => {
      await this.onParameterUpdate('payRouterProtocolFeeBp', feeBp.toString(), event, txn);
    });

    this.on(
      'UpdatedRequesterFeeBp',
      async (requester: string, feeBp: bigint, event: ContractCallEvent, txn?: Transaction) => {
        return this.onUpdatedRequesterFeeBp(requester, feeBp, event, txn);
      },
    );

    this.on(
      'UpdatedRequesterValueLockDuration',
      async (requester: string, valueLockDur: bigint, event: ContractCallEvent, txn?: Transaction) => {
        return this.onUpdatedRequesterValueLockDur(requester, valueLockDur, event, txn);
      },
    );

    this.on(
      'RouteCreated',
      async (
        routeId: bigint,
        owner: string,
        source: bigint,
        sourceToken: string,
        sourceOrgId: bigint,
        destOrgId: bigint,
        bond: bigint,
        event: ContractCallEvent,
        txn?: Transaction,
      ) => {
        return this.onRouteCreated(routeId, owner, source, sourceToken, sourceOrgId, destOrgId, bond, event, txn);
      },
    );

    this.on(
      'OrgCreated',
      async (creator: string, name: string, orgId: bigint, event: ContractCallEvent, txn?: Transaction) => {
        return this.onOrgCreated(creator, name, orgId, event, txn);
      },
    );

    this.on(
      'ApprovedRequester',
      async (routeId: bigint, requester: string, event: ContractCallEvent, txn?: Transaction) => {
        return this.onApprovedRequester(routeId, requester, event, txn);
      },
    );

    this.on(
      'UnapprovedRequester',
      async (routeId: bigint, requester: string, event: ContractCallEvent, txn?: Transaction) => {
        return this.onUnapprovedRequester(routeId, requester, event, txn);
      },
    );

    this.on(
      'DepositedBond',
      async (depositor: string, routeId: bigint, amount: bigint, event: ContractCallEvent, txn?: Transaction) => {
        return this.onDepositedBond(depositor, routeId, amount, event, txn);
      },
    );

    this.on(
      'WithdrawnBond',
      async (withdrawer: string, routeId: bigint, amount: bigint, event: ContractCallEvent, txn?: Transaction) => {
        return this.onWithdrawnBond(withdrawer, routeId, amount, event, txn);
      },
    );

    this.on(
      'RequestCreated',
      async (
        creator: string,
        requestId: bigint,
        routeIds: bigint[],
        bonds: bigint[],
        sourceAmt: bigint,
        event: ContractCallEvent,
        txn?: Transaction,
      ) => {
        return this.onRequestCreated(creator, requestId, routeIds, bonds, sourceAmt, event, txn);
      },
    );

    this.on('OrgSourcePaid', async (requestId: bigint, event: ContractCallEvent, txn?: Transaction) => {
      return this.onOrgSourcePaid(requestId, event, txn);
    });

    this.on(
      'RequestPaid',
      async (
        payer: string,
        requestId: bigint,
        routeId: bigint,
        bond: bigint,
        event: ContractCallEvent,
        txn?: Transaction,
      ) => {
        return this.onRequestPaid(payer, requestId, routeId, bond, event, txn);
      },
    );

    this.on(
      'BondReturned',
      async (owner: string, routeId: bigint, amount: bigint, event: ContractCallEvent, txn?: Transaction) => {
        return this.onBondReturned(owner, routeId, amount, event, txn);
      },
    );

    this.on('RequestClosed', async (requestId: bigint, event: ContractCallEvent, txn?: Transaction) => {
      return this.onRequestClosed(requestId, event, txn);
    });

    this.on('RequestCancelled', async (requestId: bigint, event: ContractCallEvent, txn?: Transaction) => {
      return this.onRequestCancelled(requestId, event, txn);
    });

    this.on(
      'BondTransferred',
      async (
        requestId: bigint,
        routeId: bigint,
        amount: bigint,
        beneficiary: string,
        event: ContractCallEvent,
        txn?: Transaction,
      ) => {
        return this.onBondTransferred(requestId, routeId, amount, beneficiary, event, txn);
      },
    );

    this.on(
      'SourceTransferred',
      async (requestId: bigint, amount: bigint, beneficiary: string, event: ContractCallEvent, txn?: Transaction) => {
        return this.onSourceTransferred(requestId, amount, beneficiary, event, txn);
      },
    );
  }

  /**
   * Source transferred
   * @param requestId The request ID
   * @param routeId The route ID
   * @param amount The amount
   * @param beneficiary The beneficiary address
   * @param _event The event object
   * @param txn The transaction object
   */
  async onSourceTransferred(
    requestId: bigint,
    amount: bigint,
    beneficiary: string,
    _event: ContractCallEvent,
    txn?: Transaction,
  ) {
    const request = await PayRouterRequest.findByNetworkAndRequestId(this.network, Number(requestId), txn);
    await PayRouterSourceTransfer.create(
      { network: this.network, requestId: request.id, beneficiary, amount: amount.toString() },
      txn,
    );
  }

  /**
   * Bond transferred
   * @param requestId The request ID
   * @param routeId The route ID
   * @param amount The amount
   * @param beneficiary The beneficiary address
   * @param _event The event object
   * @param txn The transaction object
   */
  async onBondTransferred(
    requestId: bigint,
    routeId: bigint,
    amount: bigint,
    beneficiary: string,
    _event: ContractCallEvent,
    txn?: Transaction,
  ) {
    const request = await PayRouterRequest.findByNetworkAndRequestId(this.network, Number(requestId), txn);
    const route = await PayRouterRoute.findByNetworkAndRouteId(this.network, Number(routeId), txn);
    await PayRouterBondTransfer.create(
      { network: this.network, requestId: request.id, routeId: route.id, beneficiary, amount: amount.toString() },
      txn,
    );
  }

  /**
   * Request cancelled
   * @param requestId The request ID
   * @param event The event object
   * @param txn The transaction object
   */
  async onRequestCancelled(requestId: bigint, event: ContractCallEvent, txn?: Transaction) {
    const request = await PayRouterRequest.findByNetworkAndRequestId(this.network, Number(requestId), txn);
    await PayRouterRequest.updateById(request.id, { cancelled: true }, txn);
  }

  /**
   * Request closed
   * @param requestId The request ID
   * @param event The event object
   * @param txn The transaction object
   */
  async onRequestClosed(requestId: bigint, event: ContractCallEvent, txn?: Transaction) {
    const request = await PayRouterRequest.findByNetworkAndRequestId(this.network, Number(requestId), txn);
    await PayRouterRequest.updateById(request.id, { closed: true }, txn);
  }

  /**
   * Bond returned
   * @param owner The owner address
   * @param routeId The route ID
   * @param amount The amount
   * @param event The event object
   * @param txn The transaction object
   */
  async onBondReturned(owner: string, routeId: bigint, amount: bigint, event: ContractCallEvent, txn?: Transaction) {
    const route = await PayRouterRoute.findByNetworkAndRouteId(this.network, Number(routeId), txn);
    await PayRouterRoute.updateById(route.id, { bond: toDec(route.bond).add(toDec(amount)).toFixed() }, txn);
  }

  /**
   * Request paid
   * @param payer The payer address
   * @param requestId The request ID
   * @param routeId The route ID
   * @param bond The bond
   * @param event The event object
   * @param txn The transaction object
   */
  async onRequestPaid(
    payer: string,
    requestId: bigint,
    routeId: bigint,
    bond: bigint,
    event: ContractCallEvent,
    txn?: Transaction,
  ) {
    const request = await PayRouterRequest.findByNetworkAndRequestId(this.network, Number(requestId), txn);
    const route = await PayRouterRoute.findByNetworkAndRouteId(this.network, Number(routeId), txn);
    const existing = await PayRouterRequestPayment.findByNetworkRequestIdAndRouteId(
      this.network,
      request.id,
      route.id,
      txn,
    );
    if (!existing) {
      await PayRouterRequestPayment.create(
        { network: this.network, payer, requestId: request.id, routeId: route.id, bond: bond.toString() },
        txn,
      );
    }
  }

  /**
   * Org source paid
   * @param requestId The request ID
   * @param _event The event object
   * @param txn The transaction object
   */
  async onOrgSourcePaid(requestId: bigint, _event: ContractCallEvent, txn?: Transaction) {
    const request = await PayRouterRequest.findByNetworkAndRequestId(this.network, Number(requestId), txn);
    await PayRouterRequest.updateById(request.id, { orgSourcePaid: true }, txn);
  }

  /**
   * Request created
   * @param creator The creator address
   * @param requestId The request ID
   * @param routeIds The route IDs
   * @param bonds The bonds
   * @param sourceAmt The source amount
   * @param _event The event object
   * @param txn The transaction object
   */
  async onRequestCreated(
    creator: string,
    requestId: bigint,
    routeIds: bigint[],
    bonds: bigint[],
    sourceAmt: bigint,
    _event: ContractCallEvent,
    txn?: Transaction,
  ) {
    let requester = await PayRouterRequester.findByNetworkAndAddress(this.network, creator, txn);
    if (!requester) requester = await PayRouterRequester.create({ network: this.network, address: creator }, txn);

    const protocolFeeBp = await Meta.getContractParam(this.network, 'payRouterProtocolFeeBp', txn);
    await PayRouterRequest.create(
      {
        network: this.network,
        creator,
        requestId: Number(requestId),
        requesterFeeBp: requester.feeBp,
        valueLockDuration: requester.valueLockDur,
        protocolFeeBp: protocolFeeBp ?? 0,
        sourceAmt: sourceAmt.toString(),
      },
      txn,
    );

    let i = 0;
    for (const routeId of routeIds) {
      const route = await PayRouterRoute.findByNetworkAndRouteId(this.network, Number(routeId), txn);
      await PayRouterRoute.updateById(route.id, { bond: toDec(route.bond).sub(toDec(bonds[i])).toFixed() }, txn);
      i++;
    }
  }

  /**
   * Withdrawn bond
   * @param _withdrawer The withdrawer address
   * @param routeId The route ID
   * @param amount The amount
   * @param event The event object
   * @param txn The transaction object
   */
  async onWithdrawnBond(
    _withdrawer: string,
    routeId: bigint,
    amount: bigint,
    event: ContractCallEvent,
    txn?: Transaction,
  ) {
    const route = await PayRouterRoute.findByNetworkAndRouteId(this.network, Number(routeId), txn);
    await PayRouterRoute.updateById(route.id, { bond: toDec(route.bond).sub(toDec(amount)).toFixed() }, txn);
  }

  /**
   * Deposited bond
   * @param _depositor The depositor address
   * @param routeId The route ID
   * @param amount The amount
   * @param _event The _event object
   * @param txn The transaction object
   */
  async onDepositedBond(
    _depositor: string,
    routeId: bigint,
    amount: bigint,
    _event: ContractCallEvent,
    txn?: Transaction,
  ) {
    const route = await PayRouterRoute.findByNetworkAndRouteId(this.network, Number(routeId), txn);
    await PayRouterRoute.updateById(route.id, { bond: toDec(route.bond).add(toDec(amount)).toFixed() }, txn);
  }

  /**
   * Unapproved requester
   * @param routeId The route ID
   * @param requester The requester address
   * @param event The event object
   * @param txn The transaction object
   */
  async onUnapprovedRequester(routeId: bigint, requester: string, event: ContractCallEvent, txn?: Transaction) {
    const route = await PayRouterRoute.findByNetworkAndRouteId(this.network, Number(routeId), txn);
    const req = await PayRouterRequester.findByNetworkAndAddress(this.network, requester, txn);
    await PayRouterRouteRequester.deleteByNetworkAndRouteIdAndRequesterId(this.network, route.id, req.id, txn);
  }

  /**
   * Approved requester
   * @param routeId The route ID
   * @param requester The requester address
   * @param event The event object
   * @param txn The transaction object
   */
  async onApprovedRequester(routeId: bigint, requester: string, event: ContractCallEvent, txn?: Transaction) {
    const route = await PayRouterRoute.findByNetworkAndRouteId(this.network, Number(routeId), txn);
    let req = await PayRouterRequester.findByNetworkAndAddress(this.network, requester, txn);
    if (!req) req = await PayRouterRequester.create({ network: this.network, address: requester }, txn);
    await PayRouterRouteRequester.create({ network: this.network, routeId: route.id, requesterId: req.id }, txn);
  }

  /**
   * Org created
   * @param creator The creator address
   * @param name The name
   * @param orgId The organization ID
   * @param event The event object
   * @param txn The transaction object
   */
  async onOrgCreated(creator: string, name: string, orgId: bigint, event: ContractCallEvent, txn?: Transaction) {
    await PayRouterOrg.create({ network: this.network, creator, name, orgId: Number(orgId) }, txn);
  }

  /**
   * Route created
   * @param owner The owner address
   * @param source The source
   * @param sourceToken The source token
   * @param sourceOrgId The source organization ID
   * @param destOrgId The destination organization ID
   * @param bond The bond
   * @param event The event object
   * @param txn The transaction object
   */
  async onRouteCreated(
    routeId: bigint,
    owner: string,
    source: bigint,
    sourceToken: string,
    sourceOrgId: bigint,
    destOrgId: bigint,
    bond: bigint,
    event: ContractCallEvent,
    txn?: Transaction,
  ) {
    await PayRouterRoute.create(
      {
        network: this.network,
        owner,
        routeId: Number(routeId),
        source: Number(source),
        sourceToken,
        sourceOrgId: Number(sourceOrgId),
        destOrgId: Number(destOrgId),
        bond: bond.toString(),
      },
      txn,
    );
  }

  /**
   * Updated requester value lock duration
   * @param requester The requester address
   * @param valueLockDur The value lock duration
   * @param event The event object
   * @param txn The transaction object
   */
  async onUpdatedRequesterValueLockDur(
    requester: string,
    valueLockDur: bigint,
    _event: ContractCallEvent,
    txn?: Transaction,
  ) {
    const existing = await PayRouterRequester.findByNetworkAndAddress(this.network, requester, txn);
    if (existing) {
      await PayRouterRequester.updateById(existing.id, { valueLockDur: Number(valueLockDur) }, txn);
    } else {
      await PayRouterRequester.create(
        { network: this.network, address: requester, valueLockDur: Number(valueLockDur) },
        txn,
      );
    }
  }

  /**
   * Updated requester fee
   * @param requester The requester address
   * @param feeBp The fee in bp
   * @param event The event object
   * @param txn The transaction object
   */
  async onUpdatedRequesterFeeBp(requester: string, feeBp: bigint, event: ContractCallEvent, txn?: Transaction) {
    const existing = await PayRouterRequester.findByNetworkAndAddress(this.network, requester, txn);
    if (existing) {
      await PayRouterRequester.updateById(existing.id, { feeBp: Number(feeBp) }, txn);
    } else {
      await PayRouterRequester.create({ network: this.network, address: requester, feeBp: Number(feeBp) }, txn);
    }
  }

  /**
   * Updated a parameter
   * @param param The parameter name
   * @param value The updated value
   * @param _event The event object
   * @param txn The transaction object
   */
  async onParameterUpdate(param: keyof ContractsParams, value: string, _event: ContractCallEvent, txn?: Transaction) {
    await Meta.updateContractsParams(this.network, txn, (params) => (params[param] = value));
  }
}
