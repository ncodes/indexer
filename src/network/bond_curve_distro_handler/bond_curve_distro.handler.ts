import { BaseContract, Provider, toNumber } from 'ethers';
import * as moment from 'moment';
import { Transaction } from 'objection';
import { toDec } from '../../common/common';
import { getClaimSig } from '../../common/crypto';
import BondingCurveTx from '../../models/bonding_curve_tx';
import BondingCurveWithdraw from '../../models/bonding_curve_withdraw';
import TokenClaim from '../../models/token_claim';
import { ContractCallEvent } from '../common';
import { Handler } from '../handler';
import NetworkService from '../network.service';

export class BondCurveDistroHandler extends Handler {
  constructor(
    private netSrv: NetworkService,
    private provider: Provider,
    public network: string,
    private contracts: JointContracts,
  ) {
    super(BondCurveDistroHandler.name, netSrv.cfgSrv, network, contracts.bondCurveDistro as unknown as BaseContract);
  }

  /**
   * Listen for events
   */
  listen() {
    this.on(
      'Claimed',
      async (
        address: string,
        claimId: bigint,
        nonce: bigint,
        allocation: bigint,
        event: ContractCallEvent,
        txn?: Transaction,
      ) => {
        return this.onClaimed(address, claimId, nonce, allocation, event, txn);
      },
    );

    this.on(
      'Buy',
      async (
        buyer: string,
        inAmt: bigint,
        outAmt: bigint,
        fee: bigint,
        event: ContractCallEvent,
        txn?: Transaction,
      ) => {
        return this.onBuy(buyer, inAmt, outAmt, fee, event, txn);
      },
    );

    this.on(
      'Sell',
      async (
        seller: string,
        inAmt: bigint,
        outAmt: bigint,
        fee: bigint,
        event: ContractCallEvent,
        txn?: Transaction,
      ) => {
        return this.onSell(seller, inAmt, outAmt, fee, event, txn);
      },
    );

    this.on('ClaimWithdrawn', async (address: string, amount: bigint, event: ContractCallEvent, txn?: Transaction) => {
      return this.onClaimWithdrawn(address, amount, event, txn);
    });
  }

  /**
   * Airdrop was claimed
   * @param address The address of the miner
   * @param claimId The claim id
   * @param nonce The unique nonce
   * @param _allocation The allocation
   * @param _event The event object
   * @param txn The transaction object
   */
  async onClaimed(
    address: string,
    claimId: bigint,
    nonce: bigint,
    _allocation: bigint,
    _event: ContractCallEvent,
    txn?: Transaction,
  ) {
    const claim = await TokenClaim.findByAddressAndClaimIdAndNonce(address, toNumber(claimId), toNumber(nonce));
    if (claim) await TokenClaim.updateById(claim.id, { claimedAt: moment().toISOString() }, txn);
  }

  /**
   * A buy was made
   * @param buyer The buyer address
   * @param inAmt The input amount
   * @param outAmt The output amount
   * @param fee The fee paid
   * @param _event The event object
   * @param txn The transaction object
   */
  async onBuy(buyer: string, inAmt: bigint, outAmt: bigint, fee: bigint, _event: ContractCallEvent, txn?: Transaction) {
    await BondingCurveTx.create(
      {
        buy: true,
        address: buyer,
        input: inAmt.toString(),
        output: outAmt.toString(),
        fee: fee.toString(),
      },
      txn,
    );

    const claim = await TokenClaim.findByAddressAndClaimId(buyer, 0);
    const resetMinSpend = toDec(this.cfg.get('app.claimResetMinSpend'));
    if (claim && !!claim.claimedAt && resetMinSpend.lte(inAmt.toString())) {
      const newNonce = claim.nonce + 1;
      const newSig = await getClaimSig(this.cfg.get('app.claimSigner'), buyer, claim.amount, 0, newNonce, 8453);
      await TokenClaim.updateById(
        claim.id,
        {
          claimedAt: null,
          nonce: newNonce,
          signature: newSig,
        },
        txn,
      );
    } else {
      console.log('No claim reset');
    }
  }

  /**
   * A sell was made
   * @param seller The seller address
   * @param inAmt The input amount
   * @param outAmt The output amount
   * @param fee The fee paid
   * @param _event The event object
   * @param txn The transaction object
   */
  async onSell(
    seller: string,
    inAmt: bigint,
    outAmt: bigint,
    fee: bigint,
    _event: ContractCallEvent,
    txn?: Transaction,
  ) {
    await BondingCurveTx.create(
      {
        buy: false,
        address: seller,
        input: inAmt.toString(),
        output: outAmt.toString(),
        fee: fee.toString(),
      },
      txn,
    );
  }

  /**
   * A claim was withdrawn
   * @param address The address of the withdrawer
   * @param amount The amount withdrawn
   * @param _event The event object
   * @param txn The transaction object
   */
  async onClaimWithdrawn(address: string, amount: bigint, _event: ContractCallEvent, txn?: Transaction) {
    await BondingCurveWithdraw.create({ address, amount: amount.toString() }, txn);
  }
}
