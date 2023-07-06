import { BaseModel } from './base';
import Objection, { Transaction } from 'objection';
import { randStr } from '../common/common';

/**
 * AssetRegistry contains information about an asset
 */
export default class AssetRegistry extends BaseModel {
  // The network where the badge was granted
  network: string = undefined;
  // Asset address
  address: string = undefined;
  // The asset exchange rate to P2P (e.g 1 ASSET -> P2P)
  curRate: string = undefined;
  // The basis point fee to charged by protocol on the asset
  feeBp: number = undefined;
  // The fixed fee rate charged by the protocol (denominated in P2P)
  feeFixed: string = undefined;
  // How much unit equates to 1 reward point (denominated in the asset)
  amountPerRewardPoint: string = undefined;
  // Indicates whether the asset is verified
  verified: boolean = undefined;
  // Indicates whether the asset is a stablecoin
  stable: boolean = undefined;
  // Indicates whether fee earned on the asset are sharable
  sharable: boolean = undefined;

  constructor(init?: Partial<AssetRegistry>) {
    super();
    Object.assign(this, init);
  }

  static get tableName() {
    return 'asset_registry';
  }

  static get relationMappings() {
    return {};
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = 'asset_registry_' + randStr(24);
  }

  $formatJson(json: Objection.Pojo): Objection.Pojo {
    const object = json as AssetRegistry;
    object.object = 'asset_registry';
    delete object.deletedAt;
    return object;
  }

  /**
   * Create a record
   * @param data The grant data
   * @param txn The transaction object
   */
  static create(data: Partial<AssetRegistry>, txn?: Transaction) {
    return this.query(txn).insertAndFetch(data);
  }

  /**
   * Find a record
   * @param q the query parameter
   * @param txn Optional transaction object
   */
  static find(q: Partial<AssetRegistry>, txn?: Transaction): Promise<AssetRegistry> {
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
   * Find a record by ID
   * @param network The network name
   * @param address The asset address
   * @param txn Optional transaction object
   */
  static getByNetworkAndAddress(network: string, address: string, txn?: Transaction) {
    return this.query(txn).whereNotDeleted().where('network', network).where('address', 'ilike', address).first();
  }

  /**
   * Delete a record
   * @param network The network name
   * @param address The address of the target record
   * @param txn Optional transaction object
   */
  static deleteByAddress(network: string, address: string, txn?: Transaction) {
    return this.query(txn).where({ network }).where('address', 'ilike', address).hardDelete();
  }

  /**
   * Check if an asset is marked as `stable`
   * @param network The network name
   * @param address The asset address
   * @param txn Optional transaction object
   */
  static async isStable(network: string, address: string, txn?: Transaction) {
    const info = await this.query(txn)
      .where({ network, stable: true })
      .where('address', 'ilike', address)
      .count()
      .first();
    return Promise.resolve(parseInt(info.count) > 0);
  }

  /**
   * Get shared assets address
   * @param network The network name
   * @param txn Optional transaction object
   */
  static async getSharedAssets(network: string, txn?: Transaction) {
    const recs = await this.query(txn).where({ network, sharable: true });
    return Promise.resolve(
      recs.map((rec) => {
        return rec.address;
      }),
    );
  }

  /**
   * Get stable assets address
   * @param network The network name
   * @param txn Optional transaction object
   */
  static async getStableAssets(network: string, txn?: Transaction) {
    const recs = await this.query(txn).where({ network, stable: true });
    return Promise.resolve(
      recs.map((rec) => {
        return rec.address;
      }),
    );
  }
}
