import { BaseModel } from './base';
import { Transaction } from 'objection';

export enum FeeName {
  InstantSwapFee = 'instantSwapFee',
  SynthSwapFee = 'syntheticSwapFee',
  StableSwapFee = 'stableSwapFee',
}

/**
 * Meta represents key and value pair.
 */
export default class Meta extends BaseModel {
  key: string;
  value: string;

  constructor(init?: Partial<Meta>) {
    super();
    Object.assign(this, init);
  }

  static get tableName() {
    return 'meta';
  }

  static get relationMappings() {
    return {};
  }

  /**
   * get finds a record by key
   * @param key The target key
   * @param txn The transaction object
   */
  static get(key: string, txn?: Transaction) {
    return this.query(txn).where({ key }).first();
  }

  /**
   * create a session for a user
   * @param key The meta key
   * @param value The meta value
   * @param txn The transaction object
   */
  static create(key: string, value: string, txn?: Transaction) {
    return this.query(txn).insertAndFetch({
      key,
      value,
    });
  }

  /**
   * update a record
   * @param key The target key
   * @param value The target value
   * @param txn The transaction object
   */
  static update(key: string, value: string, txn?: Transaction): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const existing = await this.get(key);
        if (!existing) {
          await this.query(txn).insert({ key, value });
          return resolve();
        }
        await this.query(txn).where({ id: existing.id }).patch({ value });
        return resolve();
      } catch (e) {
        return reject(e);
      }
    });
  }

  /**
   * Make protocol fee key
   * @param network The name of the network
   * @param feeName The name of the fee type
   */
  static makeProtocolFeeKey(network: string, feeName) {
    return `${network}:${feeName}`;
  }

  /**
   * Make sharable assets key
   * @param network The name of the network
   */
  static makeSharableAssetsKey(network: string) {
    return `${network}:sharableAssets`;
  }

  /**
   * Get sharable assets
   * @param network The target network
   */
  static async getShareableAssets(network: string): Promise<string[]> {
    const meta = await this.get(this.makeSharableAssetsKey(network));
    if (!meta) return Promise.resolve([]);
    return Promise.resolve(Object.keys(JSON.parse(meta.value)));
  }

  /**
   * Get stable assets
   * @param network The target network
   */
  static async getStableAssets(network: string): Promise<string[]> {
    const meta = await this.get(this.makeStableAssetsKey(network));
    if (!meta) return Promise.resolve([]);
    return Promise.resolve(Object.keys(JSON.parse(meta.value)));
  }

  /**
   * Make stable assets key
   * @param network The name of the network
   */
  static makeStableAssetsKey(network: string) {
    return `${network}:stableAssets`;
  }

  /**
   * Make verified assets key
   * @param network The name of the network
   */
  static makeVerifiedAssetsKey(network: string) {
    return `${network}:verifiedAssets`;
  }

  /**
   * Get a protocol fee
   * @param network The network name
   * @param feeName The name of the fee type
   * @param txn The transaction object
   */
  static getProtocolFee(network: string, feeName: FeeName, txn?: Transaction) {
    const key = this.makeProtocolFeeKey(network, feeName);
    return this.query(txn).where('key', key).first();
  }

  /**
   * Checks if an asset is registered stable asset
   * @param network The network name
   * @param address The asset address
   * @param txn The transaction object
   */
  static async isStableAsset(network: string, address: string, txn?: Transaction) {
    const stables = await this.get(this.makeStableAssetsKey(network), txn);
    if (!stables) return Promise.resolve(false);
    return Promise.resolve(JSON.parse(stables.value)[address] !== undefined);
  }
}
