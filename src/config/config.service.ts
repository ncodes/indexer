import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import Meta from '../models/meta';

@Injectable()
export class ConfigService extends NestConfigService {
  /**
   * Get contract parameters
   * @param network The network name
   * @param param The parameter name
   */
  async getContractParam(network: string, param: keyof ContractsParams) {
    return Meta.getContractParam(network, param);
  }
}
