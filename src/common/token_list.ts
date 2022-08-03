import * as ethereum from './tokenlist/ethereum.json';
import * as polygon from './tokenlist/polygon.json';
import * as binance from './tokenlist/binance.json';
import * as optimism from './tokenlist/optimism.json';
import * as _ from 'lodash';

/**
 * TokenList contains a network categorized list
 * of tokens whose information we cache and support
 * without having to source them externally. It
 * would typically include tokens that are popular
 * and with sufficient daily trade volume.
 */
export const TokenList = {
  ethereum,
  polygon,
  binance,
  optimism,
};

/**
 * Get token logo
 * @param network The network name
 * @param address The token address
 */
export function getTokenLogo(network: string, address: string) {
  const netList = TokenList[network];
  const token = _.find(netList.tokens, (x) => x.address === address);
  return !token ? null : token.logoURI;
}

/**
 * Get token info
 * @param network The network name
 * @param address The token address
 */
export function getTokenInfo(network: string, address: string) {
  const netList = TokenList[network];
  return _.find(netList.tokens, (x) => x.address === address);
}
