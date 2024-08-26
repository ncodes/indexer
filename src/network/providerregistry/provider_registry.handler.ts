import { Provider } from 'ethers';
import { Transaction } from 'objection';
import { Handler } from '../handler';
import { ContractCallEvent, toNumber } from '../common';
import ProviderRegistry from '../../models/provider_registry';

export class ProviderRegistryHandler extends Handler {
  constructor(private provider: Provider, public network: string, private contracts: JointContracts) {
    super(ProviderRegistryHandler.name, null, network, contracts.providerRegistry);
  }

  /**
   * Listen for events
   */
  listen() {
    this.on(
      'ProviderRegistered',
      async (provider: string, index: bigint, event: ContractCallEvent, txn?: Transaction) => {
        return this.onProviderRegistered(provider, index, event, txn);
      },
    );
  }

  /**
   * A provider was registered
   * @param provider The provider address
   * @param index The provider index
   * @param _event The event object
   * @param txn The transaction object
   */
  async onProviderRegistered(provider: string, index: bigint, _event: ContractCallEvent, txn?: Transaction) {
    const existing = await ProviderRegistry.getByNetworkAndAddress(this.network, provider, txn);
    if (!existing)
      await ProviderRegistry.create({ network: this.network, address: provider, index: toNumber(index) }, txn);
  }
}
