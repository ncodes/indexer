import { addTokenToLocalhost } from '@jointlabs/meta';
import { isLocal } from './common';

if (isLocal()) {
  addTokenToLocalhost([
    {
      asset: '0002',
      type: 'ERC20',
      address: process.env.LOCALHOST_WRAPPED_TOKEN_ADDRESS,
      name: 'WETH LOCAL',
      symbol: 'WETH',
      decimals: 18,
      logoURI:
        'https://assets-cdn.trustwallet.com/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png',
      price: 0,
    },
    {
      asset: '0000',
      type: 'NATIVE',
      address: process.env.LOCALHOST_NATIVE_ETH_TOKEN_ADDRESS,
      name: 'ETH',
      symbol: 'ETH',
      native: true,
      decimals: 18,
      logoURI: 'https://files.joint.exchange/images/eth.svg',
      price: 0,
    },
    {
      asset: '0001',
      type: 'ERC20',
      address: process.env.LOCALHOST_TOKEN_ADDRESS,
      name: 'Joint LOCAL',
      symbol: 'JOIN',
      decimals: 18,
      logoURI: 'https://files.joint.exchange/images/join.svg',
      price: 1,
    },
    // {
    //   asset: '0003',
    //   type: 'ERC20',
    //   address: process.env.LOCALHOST_UNI_TOKEN_ADDRESS,
    //   name: 'UNI LOCAL',
    //   symbol: 'UNI',
    //   decimals: 18,
    //   logoURI:
    //     'https://assets-cdn.trustwallet.com/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png',
    //   price: 0,
    // },
    {
      asset: '0004',
      type: 'SYNTHETIC',
      address: process.env.LOCALHOST_NGN_TOKEN_ADDRESS,
      name: 'NGN LOCAL',
      symbol: 'NGN',
      decimals: 18,
      logoURI: 'https://files.joint.exchange/images/nigeria.svg',
      price: 0,
    },
  ]);
}
