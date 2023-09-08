import * as ethereum from './tokenlist/ethereum.json';
import * as polygon from './tokenlist/polygon.json';
import * as binance from './tokenlist/binance.json';
import * as optimism from './tokenlist/optimism.json';
import * as localhost from './tokenlist/localhost.json';
import * as synthetic from './tokenlist/synthetic.json';
import * as _ from 'lodash';

export type ListName = 'ethereum' | 'polygon' | 'binance' | 'optimism' | 'localhost' | 'synthetic';

/**
 * TokenList contains a network categorized list
 * of tokens whose information we cache and support
 * without having to source them externally. It
 * would typically include tokens that are popular
 * and with sufficient daily trade volume.
 *
 * This list relies on TrustWallet's assets list:
 * https://github.com/trustwallet/assets
 */
export const TokenLists: { [key in ListName]: TokenList.TokenData } = {
  ethereum,
  polygon,
  binance,
  optimism,
  localhost,
  synthetic,
};

/**
 * Get token info
 * @param network The network name
 * @param address The token address
 */
export function getTokenInfo(network: string, address: string): TokenList.Token {
  const netList = TokenLists[network];
  if (!netList) return;
  return _.find(netList.tokens, (x) => x.address === address);
}

/**
 * Find a given asset in the local token list
 * @param address The target address
 */
export function findInLocalhost(address: string): TokenList.Token {
  return TokenLists.localhost.tokens.find((token) => {
    return token.address.toLowerCase() === address.toLowerCase();
  });
}

/**
 * Find a given asset in the synthetic token list
 * @param address The target address
 */
export function findInSynthetic(address: string): TokenList.Token {
  return TokenLists.synthetic.tokens.find((token) => {
    const match = token.address.toLowerCase() === address.toLowerCase();
    if (!match) return;
    token.isSynthetic = true;
    return token;
  });
}
