import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as qs from 'qs';
import { handleAxiosError } from '../common/errors/http_response_error';

interface TwitterSearchResponse {
  data: Datum[];
  meta: Meta;
}

interface Meta {
  newest_id: string;
  oldest_id: string;
  result_count: number;
  next_token: string;
}

interface Datum {
  author_id: string;
  text: string;
  edit_history_tweet_ids: string[];
  id: string;
  referenced_tweets?: Referencedtweet[];
}

interface Referencedtweet {
  type: 'quoted' | 'replied_to' | 'retweeted';
  id: string;
}

@Injectable()
export class TwitterService {
  constructor(private cfgSrv: ConfigService) {}

  async getOAuthToken(code: string): Promise<string> {
    const res = await axios({
      method: 'post',
      url: 'https://api.twitter.com/2/oauth2/token',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: qs.stringify({
        code: code,
        grant_type: 'authorization_code',
        client_id: this.cfgSrv.get('app.twitter.oauthClientId'),
        redirect_uri: this.cfgSrv.get('app.twitter.callbackUrl'),
        code_verifier: 'challenge',
      }),
    });
    return res.data.access_token;
  }

  async search(
    query: string,
    sinceId?: string,
    tweetFields = 'author_id,referenced_tweets',
    limit = 10,
    nextToken?: string,
  ) {
    const params = {
      query,
      since_id: sinceId,
      'tweet.fields': tweetFields,
      max_results: limit,
      next_token: nextToken,
    };

    if (!sinceId) {
      delete params.since_id;
    }

    if (!nextToken) {
      delete params.next_token;
    }

    try {
      const resp = await axios.get(`https://api.twitter.com/2/tweets/search/recent`, {
        params,
        headers: {
          Authorization: `Bearer ${this.cfgSrv.get('app.twitter.bearerToken')}`,
        },
      });

      return resp.data as TwitterSearchResponse;
    } catch (error) {
      throw handleAxiosError(error);
    }
  }

  /**
   * Get the tweet ID from the URL
   * @param url The tweet URL
   * @returns The tweet ID
   */
  getTweetIdFromUrl(url: string): string {
    const match = url.match(/\/status\/(\d+)/);
    return match ? match[1] : '';
  }
}
