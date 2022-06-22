export const TokenList = {
  0x0b306bf915c4d645ff596e518faf3f9669b97016: {
    name: 'BASE',
    image: 'https://logoA.com',
  },
  '0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1': {
    name: 'QUOTE',
    image: 'https://logoB.com',
  },
};

/**
 * Get token logo
 * @param address The address
 */
export function getTokenLogo(address: string) {
  const info = TokenList[address];
  if (!info) return null;
  return info.image;
}
