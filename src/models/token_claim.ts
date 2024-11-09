import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * TokenClaims represents the airdrop claims
 */
export default class TokenClaim extends BaseModel {
  name: string = undefined;
  address: string = undefined;
  amount: string = undefined;
  nonce: number = undefined;
  claimId: number = undefined;
  claimedAt: string = undefined;
  signature: string = undefined;

  constructor(init?: Partial<TokenClaim>) {
    super();
    Object.assign(this, init);
  }

  static get tableName() {
    return 'token_claims';
  }

  static get relationMappings() {
    return {};
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'token_claim_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as TokenClaim;
    object.object = 'token_claims';
    delete object.deletedAt;
    return object;
  }

  /**
   * Create a record
   * @param data The issuer data
   * @param txn The transaction object
   */
  static create(data: Partial<TokenClaim>, txn?: Transaction) {
    return this.query(txn).insertAndFetch(data);
  }

  /**
   * Find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<TokenClaim>, txn?: Transaction): Promise<TokenClaim> {
    return new Promise((resolve, reject) => {
      this.query(txn).where(q).whereNotDeleted().first().then(resolve).catch(reject);
    });
  }

  /**
   * Find a record by ID
   * @param id The record id
   * @param txn Optional transaction object
   */
  static getById(id: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().findById(id);
  }

  /**
   * Updates a record by ID
   * @param id the record id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<TokenClaim>, txn?: Transaction): Promise<TokenClaim> {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }

  static findByAddressAndClaimId(address: string, claimId: number) {
    return this.query().where('address', 'ILIKE', address).where('claimId', '=', claimId).whereNotDeleted().first();
  }

  static findByAddressAndClaimIdAndNonce(address: string, claimId: number, nonce: number) {
    return this.query()
      .where('address', 'ILIKE', address)
      .where('claimId', '=', claimId)
      .where('nonce', '=', nonce)
      .whereNotDeleted()
      .first();
  }

  static findByName(name: string) {
    return this.query().where('name', name).whereNotDeleted().first();
  }

  static findByAddress(address: string) {
    return this.query().where('address', address).whereNotDeleted().orderBy('claimId', 'asc');
  }

  static findAll() {
    return this.query().whereNotDeleted().orderBy('claimId', 'asc');
  }
}
