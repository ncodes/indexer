import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { isAxiosError } from 'axios';
import { handleAxiosError } from '../common/errors/http_response_error';

@Injectable()
export class JointLinkService {
  constructor(private cfgSrv: ConfigService) {}

  /**
   * Create a short referral link
   * @param code The code to use
   * @returns
   */
  async createReferralLink(code: string): Promise<{
    url: string;
    normalizedUrl: string;
    shortUrl: string;
  }> {
    try {
      const res = await axios.post(
        `${this.cfgSrv.get('app.jntLinkApiUrl')}/create`,
        {},
        {
          params: { custom: code, url: `${this.cfgSrv.get('app.appUrl')}/r/${code}` },
          headers: {
            'X-TOKEN': this.cfgSrv.get('app.jntLinkApiKey'),
          },
        },
      );
      return res.data;
    } catch (error) {
      let msg = 'server error';
      if (isAxiosError(error)) msg = (handleAxiosError(error).message as unknown as { error: string }).error;
      throw new Error(msg);
    }
  }
}
