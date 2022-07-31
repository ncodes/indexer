import { SupportedNetworks } from '../network/common';

export let FeaturedAssets = [
  {
    symbol: 'BTC',
    contracts: [
      {
        net: SupportedNetworks.Ethereum,
        addr: '0x0B306BF915C4d645ff596e518fAf3F9669b97016',
      },
      {
        net: SupportedNetworks.Ethereum,
        addr: '0x0B306BF915C4d645ff596e518fAf3F9669b97016',
      },
    ],
  },
];

export function setFeaturedAssets(v: any) {
  FeaturedAssets = v;
}
