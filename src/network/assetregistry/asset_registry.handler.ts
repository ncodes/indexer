import { Provider } from 'ethers';
import { toNumber } from 'lodash';
import { Transaction } from 'objection';
import AssetRegistry from '../../models/asset_registry';
import { Handler } from '../handler';

export class AssetRegistryHandler extends Handler {
  constructor(private provider: Provider, public network: string, private contracts: JointContracts) {
    super(AssetRegistryHandler.name, null, network, contracts.assetRegistry);
  }

  /**
   * Listen for events
   */
  listen() {
    this.on(
      'AssetRegistryUpdated',
      async (
        address: string,
        curRate: bigint,
        feeBp: bigint,
        feeFixed: bigint,
        verified: boolean,
        stable: boolean,
        sharable: boolean,
        event: Event,
        txn?: Transaction,
      ) => {
        return this.onAssetRegistryUpdated(address, curRate, feeBp, feeFixed, verified, stable, sharable, event, txn);
      },
    );
  }

  /**
   * Updated an assets registry information
   * @param address The asset address
   * @param curRate The asset exchange rate to JOIN (e.g 1 ASSET -> JOIN)
   * @param feeBp The basis point fee to charged by protocol on the asset
   * @param feeFixed The fixed fee rate charged by the protocol (denominated in JOIN)
   * @param verified Indicates whether the asset is verified
   * @param stable Indicates whether the asset is a stablecoin
   * @param sharable Indicates whether fee earned on the asset are sharable
   * @param _event The event object
   * @param txn The db transaction object
   */
  async onAssetRegistryUpdated(
    address: string,
    curRate: bigint,
    feeBp: bigint,
    feeFixed: bigint,
    verified: boolean,
    stable: boolean,
    sharable: boolean,
    _event: Event,
    txn?: Transaction,
  ) {
    await AssetRegistry.deleteByAddress(this.network, address, txn);
    await AssetRegistry.create(
      {
        network: this.network,
        address,
        curRate: curRate.toString(),
        feeBp: toNumber(feeBp.toString()),
        feeFixed: feeFixed.toString(),
        verified,
        stable,
        sharable,
      },
      txn,
    );
  }
}
