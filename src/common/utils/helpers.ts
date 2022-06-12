export function shortenAddr(addr: string) {
  return `${addr.substr(0, 4)}...${addr.substr(addr.length - 4)}`;
}
