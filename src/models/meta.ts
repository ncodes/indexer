import { Transaction } from 'objection';
import { BaseModel } from './base';

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

export enum MetaKeys {
  ContractsParams = 'contractsParams',
  MediatorPool = 'mediatorPool',
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
   * Make network-scoped key
   * @param network The name of the network
   * @param keyName The name of the key name
   */
  static makeNetKey(network: string, keyName: string) {
    return `${network}:${keyName}`;
  }

  /**
   * Make mediator pool key
   * @param network The name of the network
   * @param poolId The pool id
   */
  static makeMediatorPoolKey(network: string, poolId: number) {
    return this.makeNetKey(network, `${MetaKeys.MediatorPool}:${poolId}`);
  }

  /**
   * Get JSON value
   * @param key The target key
   * @param txn The transaction object
   */
  static getJSON<T>(key: string, txn?: Transaction): Promise<T> {
    return this.get(key, txn).then((rec) => {
      return rec ? JSON.parse(rec.value) : null;
    });
  }

  /**
   * Get a protocol fee
   * @param network The network name
   * @param feeName The name of the fee type
   * @param txn The transaction object
   */
  static async getProtocolFee(network: string, feeName: FeeName, txn?: Transaction) {
    const key = this.makeNetKey(network, feeName);
    const rec = await this.query(txn).where('key', key).first();
    return rec ? parseFloat(rec.value) : '0';
  }

  /**
   * Update contracts parameters metadata of a network
   * @param network The network name
   * @param txn The transaction object
   * @param updFn The update function
   */
  static async updateContractsParams(
    network: string,
    txn: Transaction,
    updFn: (params: { ContractParamKey: string }) => void,
  ) {
    const key = Meta.makeNetKey(network, MetaKeys.ContractsParams);
    let existing = await Meta.get(key, txn);
    if (!existing) existing = await Meta.create(key, JSON.stringify({}), txn);
    if (!existing.value) existing.value = '{}';
    const obj = JSON.parse(existing.value);
    if (updFn) updFn(obj);
    await Meta.update(key, JSON.stringify(obj), txn);
  }

  /**
   * Get a contract parameter
   * @param network The network name
   * @param param The name of the parameter
   * @param txn The transaction object
   */
  static async getContractParam<T extends keyof ContractsParams>(
    network: string,
    param: T,
    txn?: Transaction,
  ): Promise<ContractsParams[T]> {
    const key = Meta.makeNetKey(network, MetaKeys.ContractsParams);
    const existing = await Meta.get(key, txn);
    if (!existing) throw new Error('Contracts params not initialized');
    const obj = JSON.parse(existing.value);
    return obj[param];
  }
}
