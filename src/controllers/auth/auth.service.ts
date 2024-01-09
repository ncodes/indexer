import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as appRoot from 'app-root-path';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { isEqualStr } from '../../common/common';

@Injectable()
export class AuthService {
  constructor(private cfgSrv: ConfigService) {}

  /**
   * Check if an address is in the private allowlist
   * @param address The address to check
   * @returns
   */
  isInPrivateAllowlist(address: string) {
    const allowlist = fs.readFileSync(path.join(appRoot.path, 'allowlist/private_test.txt'), 'utf8');
    const lines = allowlist.split('\n');
    return lines.some((line) => isEqualStr(line.trim(), address.trim()));
  }

  /**
   * Get a discord access token
   * @param code The code from discord OAuth flow
   */
  async getDiscordAccessToken(code: string) {
    const resp = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: this.cfgSrv.get('app.discord.clientId'),
        client_secret: this.cfgSrv.get('app.discord.clientSecret'),
        grant_type: 'authorization_code',
        redirect_uri: this.cfgSrv.get('app.discord.redirectUri'),
        scope: 'identify,guilds',
        code: code,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );
    return resp.data;
  }

  /**
   * Get the discord user from an access token
   * @param accessToken The access token
   * @returns
   */
  async getDiscordAuthedUser(accessToken: string) {
    const resp = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return resp.data;
  }

  /**
   * Get the authenticated discord user guilds from an access token
   * @param accessToken The access token
   * @returns
   */
  async getAuthedUserDiscordGuilds(accessToken: string) {
    const resp = await axios.get('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return resp.data;
  }
}
