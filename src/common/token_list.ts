import * as _ from 'lodash';
import { NetworkNames } from '../network/common';
import { isEqualStr } from './common';
import * as binance from './tokenlist/binance.json';
import * as ethereum from './tokenlist/ethereum.json';
import * as localhost from './tokenlist/localhost.json';
import * as optimism from './tokenlist/optimism.json';
import * as polygon from './tokenlist/polygon.json';
import * as sepolia from './tokenlist/sepolia.json';
import * as synthetic from './tokenlist/synthetic.json';

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
export const TokenLists: { [key in NetworkNames]: TokenList.TokenData } = {
  ethereum,
  polygon,
  binance,
  optimism,
  synthetic,
  localhost,
  sepolia,
};

/**
 * Get token info
 * @param network The network name
 * @param address The token address
 */
export function getTokenInfo(network: string, address: string): TokenList.Token {
  const netList = TokenLists[network];
  if (!netList) return;
  return _.find(netList.tokens, (x) => isEqualStr(x.address, address));
}

/**
 * Find a given asset in the local token list
 * @param address The target address
 */
export function findInLocalhost(address: string): TokenList.Token {
  return TokenLists.localhost.tokens.find((token) => {
    const match = isEqualStr(token.address, address);
    if (!match) return;
    token.isSynthetic = token.isSynthetic || token.type == 'SYNTHETIC';
    return token;
  });
}

/**
 * Find a given asset in the synthetic token list
 * @param address The target address
 */
export function findInSynthetic(address: string): TokenList.Token {
  return TokenLists.synthetic.tokens.find((token) => {
    const match = isEqualStr(token.address, address);
    if (!match) return;
    token.isSynthetic = token.isSynthetic || token.type == 'SYNTHETIC';
    return token;
  });
}
