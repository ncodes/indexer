import Nomics from 'nomics';

export class NomicsMetadata {
  private client: Nomics;

  constructor(key: string) {
    this.client = new Nomics({ apiKey: key });
  }

  async getTokenLogo(symbol: string, contract: string): Promise<string> {
    const tickers = await this.client.currenciesTicker({
      ids: [symbol.toUpperCase()],
      interval: ['1d'],
    });
    if (!tickers.length) return Promise.resolve(undefined);
    return Promise.resolve(tickers[0].logo_url);
  }

  getTokenInfo(symbol: string, contract: string): Promise<TokenInfo> {
    return Promise.reject(new Error('not implemented'));
  }
}
