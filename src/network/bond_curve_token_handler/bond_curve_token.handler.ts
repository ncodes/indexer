import { Provider } from 'ethers';
import * as moment from 'moment';
import { Transaction } from 'objection';
import BondingCurveTx from '../../models/bonding_curve_tx';
import BondingCurveWithdraw from '../../models/bonding_curve_withdraw';
import MerkleTree from '../../models/merkle_tree';
import { ContractCallEvent, toNumber } from '../common';
import { Handler } from '../handler';

export class BondCurveTokenHandler extends Handler {
  constructor(private provider: Provider, public network: string, private contracts: JointContracts) {
    super(BondCurveTokenHandler.name, null, network, contracts.nativeToken);
  }

  /**
   * Listen for events
   */
  listen() {
    this.on(
      'Claimed',
      async (address: string, claimId: bigint, allocation: bigint, event: ContractCallEvent, txn?: Transaction) => {
        return this.onClaimed(address, claimId, allocation, event, txn);
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
   * @param allocation The allocation
   * @param event The event object
   * @param txn The transaction object
   */
  async onClaimed(address: string, claimId: bigint, allocation: bigint, _event: ContractCallEvent, txn?: Transaction) {
    const claim = await MerkleTree.findByAddressAndClaimId(address, toNumber(claimId));
    if (claim) await MerkleTree.updateById(claim.id, { claimedAt: moment().toISOString() }, txn);
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

    const claimZero = await MerkleTree.findByAddressAndClaimId(buyer, 0);
    if (claimZero) await MerkleTree.updateById(claimZero.id, { claimedAt: null }, txn);
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
