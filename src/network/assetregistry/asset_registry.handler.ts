import { BigNumber, Event, providers } from 'ethers';
import { Handler } from '../handler';
import { Transaction } from 'objection';
import AssetRegistry from '../../models/asset_registry';

export class AssetRegistryHandler extends Handler {
  constructor(private provider: providers.JsonRpcProvider, public network: string, private contracts: JointContracts) {
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
        curRate: BigNumber,
        feeBp: BigNumber,
        feeFixed: BigNumber,
        amountPerRewardPoint: BigNumber,
        verified: boolean,
        stable: boolean,
        sharable: boolean,
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
          sharable,
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
   * @param sharable Indicates whether fee earned on the asset are sharable
   * @param event The event object
   * @param txn The db transaction object
   */
  async onAssetRegistryUpdated(
    address: string,
    curRate: BigNumber,
    feeBp: BigNumber,
    feeFixed: BigNumber,
    amountPerRewardPoint: BigNumber,
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
        feeBp: feeBp.toNumber(),
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
