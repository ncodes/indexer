import { BaseModel } from './base';
import { Transaction } from 'objection';

export enum FeeName {
  InstantSwapFeeBp = 'instantSwapFeeBp',
  SynthSwapFeeBp = 'syntheticSwapFeeBp',
  StableSwapFeeBp = 'stableSwapFeeBp',
  FixedSynthSwapFee = 'fixedSynthSwapFee',
  FixedNFTSwapFee = 'fixedNFTSwapFee',
  InstantNFTSwapFeeBp = 'instantNFTSwapFeeBp',
}

export enum ProtocolFeeBeneficiary {
  Inventor = 'inventor_fee_bp',
  Shared = 'shared_fee_bp',
  Operator = 'operator_fee_bp',
}

export enum ProtocolParams {
  NFTDiscountBP = 'nft_discount_bp',
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
   * Get a protocol fee
   * @param network The network name
   * @param feeName The name of the fee type
   * @param txn The transaction object
   */
  static async getProtocolFee(network: string, feeName: FeeName, txn?: Transaction) {
    const key = this.makeProtocolFeeKey(network, feeName);
    const rec = await this.query(txn).where('key', key).first();
    return rec ? parseFloat(rec.value) : '0';
  }
}
