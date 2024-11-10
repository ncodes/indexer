import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * TokenClaims represents the airdrop claims
 */
export default class ClaimCheckLog extends BaseModel {
  name: string = undefined;
  address: string = undefined;
  chainId: number = undefined;

  constructor(init?: Partial<ClaimCheckLog>) {
    super();
    Object.assign(this, init);
  }

  static get tableName() {
    return 'claim_check_logs';
  }

  static get relationMappings() {
    return {};
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'ccl_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as ClaimCheckLog;
    object.object = 'ccl';
    delete object.deletedAt;
    delete object.sn;
    return object;
  }

  /**
   * Create a record
   * @param data The issuer data
   * @param txn The transaction object
   */
  static create(data: Partial<ClaimCheckLog>, txn?: Transaction) {
    return this.query(txn).insertAndFetch(data);
  }

  /**
   * Find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<ClaimCheckLog>, txn?: Transaction): Promise<ClaimCheckLog> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  static findByChainAndAddress(chainId: number, address: string, txn?: Transaction) {
    return this.query(txn).where({ chainId }).where('address', 'ilike', address).first();
  }
}
