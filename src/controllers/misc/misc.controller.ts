import { Controller, Get, Param, Query } from '@nestjs/common';
import { getTokenInfo, TokenList } from '../../common/token_list';
import { ok } from '../../common/responses/responses';
import { MetadataService } from '../../services/metadata/metadata.service';
import NetworkService from '../../network/network.service';

@Controller('v1/misc')
export class MiscController {
  constructor(private metadataSrv: MetadataService, private netSrv: NetworkService) {}

  /**
   * Get token list
   * @param network The network name
   */
  @Get('token-list/:network')
  async getTokenList(@Param('network') network: string) {
    return ok().data(TokenList[network]).build();
  }

  /**
   * Get token information. If unable to find token info in local index,
   * it will be sourced from an external source provided by MetadataService.
   * @param network The network name
   * @param address The contract name
   */
  @Get('token-info/:network/:address')
  async getTokenInfo(@Param('network') network: string, @Param('address') address: string) {
    let info = getTokenInfo(network, address);
    if (!info) info = await this.metadataSrv.getTokenInfo(network, address);
    return ok().data(info).build();
  }
}
