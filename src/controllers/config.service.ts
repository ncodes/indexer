import { Injectable } from '@nestjs/common';
import { ConfigService as CS } from '@nestjs/config';

@Injectable()
export class ConfigService extends CS {
  /**
   * Get contract parameters
   * @param network The network name
   * @param param The parameter name
   */
  getContractParam(network: string, param: string): string {
    return this.get(`app.contractsParams.${network}.${param}`);
  }
}
