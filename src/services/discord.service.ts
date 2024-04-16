import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export default class DiscordService {
  constructor(private cfgSrv: ConfigService) {}

  async getToken(code: string): Promise<string> {
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
    return resp.data.access_token;
  }

  async getMe(token: string): Promise<{ username: string }> {
    const resp = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return resp.data;
  }

  async getUserGuilds(token: string): Promise<{ id: string }[]> {
    const resp = await axios.get('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return resp.data;
  }

  async getUserGuildInfo(token: string, guildId: string): Promise<{ roles: string[] }> {
    const resp = await axios.get(`https://discord.com/api/users/@me/guilds/${guildId}/member`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return resp.data;
  }
}
