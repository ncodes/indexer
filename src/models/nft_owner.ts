import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';
import { BaseModel } from './base';

/**
 * NFTOwner represents an NFT owner
 */
export default class NFTOwner extends BaseModel {
  // The address of the owner
  address: string;
  // The token ID
  tokenId: number;

  constructor(init?: Partial<NFTOwner>) {
    super();
    Object.assign(this, init);
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'nft_owner_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as NFTOwner;
    object.object = 'nft_owner';
    delete object.deletedAt;
    return object;
  }

  static get tableName() {
    return 'nft_owners';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * create a record
   * @param data The record info
   * @param txn Optional transaction object
   */
  static create(data: Partial<NFTOwner>, txn?: Transaction): Promise<NFTOwner> {
    return new Promise(async (resolve, reject) => {
      return this.query(txn).insertAndFetch(data).then(resolve).catch(reject);
    });
  }

  /**
   * find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<NFTOwner>, txn?: Transaction): Promise<NFTOwner> {
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
   * @param id the record id
   * @param udp the fields to be updated
   * @param txn Optional transaction object
   */
  static updateById(id: string, udp: Partial<NFTOwner>, txn?: Transaction): Promise<NFTOwner> {
    return new Promise((resolve, reject) => {
      this.query(txn).whereNotDeleted().patchAndFetchById(id, udp).execute().then(resolve).catch(reject);
    });
  }

  /**
   * Delete by address and token ID
   * @param address The address of the owner
   * @param tokenId The token ID
   * @param txn Optional transaction object
   * @returns
   */
  static deleteByAddressAndTokenId(address: string, tokenId: number, txn?: Transaction) {
    return this.query(txn).where('address', 'ilike', address).where('tokenId', tokenId).delete();
  }

  /**
   * Finds records by address
   * @param address The address
   * @param txn Optional transaction object
   * @returns
   */
  static findByAddress(address: string, txn?: Transaction) {
    return this.query(txn).where('address', 'ilike', address).whereNotDeleted();
  }
}
