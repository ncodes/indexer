import { ChainNames } from '@jointlabs/meta';

interface FeaturedAsset {
  // The asset symbol
  symbol: string;
  // The dominant color of the asset
  dominantColor: string;
  // The asset contracts
  contracts: {
    // The network name
    net: ChainNames;
    // The contract address
    addr: string;
    // Whether this is the primary network for the asset.
    // Usually, the network with the most volume should be the primary.
    primary?: boolean;
  }[];
}

export let FeaturedAssets: FeaturedAsset[] = [
  {
    symbol: 'BTC',
    dominantColor: '#000000',
    contracts: [
      {
        net: 'ethereum',
        addr: '0x0B306BF915C4d645ff596e518fAf3F9669b97016',
        primary: true,
      },
      {
        net: 'ethereum',
        addr: '0x0B306BF915C4d645ff596e518fAf3F9669b97016',
      },
    ],
  },
];

export function setFeaturedAssets(v: FeaturedAsset[]) {
  FeaturedAssets = v;
}
