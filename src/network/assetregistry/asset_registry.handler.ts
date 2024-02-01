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
        amountPerRewardPoint: bigint,
        verified: boolean,
        stable: boolean,
        shareable: boolean,
        event: Event,
        txn?: Transaction,
      ) => {
        return this.onAssetRegistryUpdated(
          address,
          curRate,
          feeBp,
          feeFixed,
          amountPerRewardPoint,
          verified,
          stable,
          shareable,
          event,
          txn,
        );
      },
    );
  }

  /**
   * Updated an assets registry information
   * @param address The asset address
   * @param curRate The asset exchange rate to P2P (e.g 1 ASSET -> P2P)
   * @param feeBp The basis point fee to charged by protocol on the asset
   * @param feeFixed The fixed fee rate charged by the protocol (denominated in P2P)
   * @param amountPerRewardPoint How much unit equates to 1 reward point (denominated in the asset)
   * @param verified Indicates whether the asset is verified
   * @param stable Indicates whether the asset is a stablecoin
   * @param shareable Indicates whether fee earned on the asset are shareable
   * @param event The event object
   * @param txn The db transaction object
   */
  async onAssetRegistryUpdated(
    address: string,
    curRate: bigint,
    feeBp: bigint,
    feeFixed: bigint,
    amountPerRewardPoint: bigint,
    verified: boolean,
    stable: boolean,
    sharable: boolean,
    event: Event,
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
        amountPerRewardPoint: amountPerRewardPoint.toString(),
        verified,
        stable,
        sharable,
      },
      txn,
    );
  }
}
