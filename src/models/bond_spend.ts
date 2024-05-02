import Objection, { Transaction, raw } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';
import Battle from './battle';

/**
 * BondSpend represents a bond spend event
 */
export default class BondSpend extends BaseModel {
  userId: string;
  battleId: string;
  amount: string;
  side: 'droid' | 'bandit';
  allocationId: string;

  // Not persisted
  stakeScore: string;

  constructor(init?: Partial<BondSpend>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'bond_spend_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as BondSpend;
    object.object = 'bond_spend';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'bond_spends';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<BondSpend>, txn?: Transaction): Promise<BondSpend> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<BondSpend>, txn?: Transaction): Promise<BondSpend> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * getById finds a record by ID
   * @param id The record id
   * @param txn Optional transaction object
   */
  static getById(id: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().findById(id);
  }

  /**
   * updateById updates a record by ID
   * @param id the notification id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<BondSpend>, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().patchAndFetchById(id, udp);
  }

  // Get total spend for a user
  static getTotalSpend(userId: string, txn?: Transaction): Promise<string> {
    return new Promise((resolve, reject) => {
      this.query(txn)
        .where('userId', userId)
        .whereNotDeleted()
        .sum('amount')
        .first()
        .then((result: any) => {
          resolve(result.sum || '0');
        })
        .catch(reject);
    });
  }

  static getUnallocatedSpend(battle: Battle, battleSide?: string, txn?: Transaction) {
    return this.query(txn)
      .select(
        raw(
          '*,(86400 - EXTRACT(EPOCH FROM (bond_spends."createdAt" - ?)) * bond_spends.amount) as "stakeScore"',
          battle.createdAt,
        ),
      )
      .where('battleId', battle.id)
      .where((q) => {
        if (battleSide) return q.where('side', battleSide);
      })
      .whereNotDeleted()
      .whereNull('allocationId');
  }

  /**
   * Get the total stake score for a battle side
   * @param battleId The battle ID
   * @param battleSide The battle side
   * @param txn Optional transaction object
   * @returns
   */
  static async getTotalStakeScore(battleId: string, battleSide: string, txn?: Transaction) {
    return this.query(txn)
      .select(raw('SUM("stakeScore") as "totalStakeScore"'))
      .from(
        this.query(txn)
          .select(
            raw(
              '(86400 - EXTRACT(EPOCH FROM (bond_spends."createdAt" - battles."createdAt")) * bond_spends.amount) as "stakeScore"',
            ),
          )
          .innerJoin('battles', 'bond_spends.battleId', 'battles.id')
          .where('bond_spends.battleId', battleId)
          .where('bond_spends.side', battleSide)
          .as('bond_spends'),
      )
      .first()
      .then((result: any) => result.totalStakeScore || '0');
  }
}
