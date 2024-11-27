import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export default class EtherScanService {
  private readonly logger = new Logger(EtherScanService.name);

  constructor(private cfgSrv: ConfigService) {}

  private async getTxlist(
    chainId: number,
    userAddress: string,
    startBlock: number,
    endBlock: number,
    page: number,
    offset: number,
  ): Promise<{
    status: '1' | '0';
    message: string;
    result: EtherScanTx[];
  }> {
    const apiKey = this.cfgSrv.get(`app.etherscan.apiKey`);
    const resp = await axios.get('https://api.etherscan.io/v2/api', {
      params: {
        chainid: chainId,
        apikey: apiKey,
        module: 'account',
        action: 'txlist',
        address: userAddress,
        startblock: startBlock.toString(),
        endblock: endBlock.toString(),
        page: page.toString(),
        offset: offset.toString(),
      },
    });
    return resp.data;
  }

  /**
   * Check if the user has interacted with the routers
   * @param id - Chain id
   * @param startBlock - Start block
   * @param endBlock - End block
   * @param userAddress - User address
   * @param routers - Uniswap router addresses for the chain
   * @returns True if the user has interacted with the routers, false otherwise
   */
  async check({
    id,
    startBlock,
    endBlock,
    userAddress,
    routers,
  }: {
    id: number;
    startBlock: number;
    endBlock: number;
    userAddress: string;
    routers: string[];
  }) {
    routers = routers.map((r) => r.toLowerCase());
    let page = 1;
    let offset = 3300;
    let foundTx = false;
    while (true) {
      try {
        const txlist = await this.getTxlist(id, userAddress, startBlock, endBlock, page, offset);

        if (txlist.message != 'OK' && !Array.isArray(txlist.result)) {
          if (txlist.message.includes('window is too large')) {
            offset -= 1000;
            this.logger.log(`window is too large, reducing offset to ${offset} of page ${page}`);
            continue;
          } else {
            this.logger.error('Error fetching txlist: ', txlist);
            throw new Error('Api Error');
          }
        }

        if (Array.isArray(txlist.result) && txlist.result.length === 0) break;

        for (const tx of txlist.result) {
          if (routers.includes(tx.to.toLowerCase())) {
            foundTx = true;
            this.logger.log(`found on chain ${id}, txn: ${tx.hash}`);
            break;
          }
        }

        if (foundTx) break;

        page++;
      } catch (error) {
        this.logger.error('Error fetching txlist', error);
        throw new Error('server error');
      }
    }

    return foundTx;
  }
}

type EtherScanTx = {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  transactionIndex: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  contractAddress: string;
  cumulativeGasUsed: string;
  gasUsed: string;
  confirmations: string;
  methodId: string;
  functionName: string;
};
