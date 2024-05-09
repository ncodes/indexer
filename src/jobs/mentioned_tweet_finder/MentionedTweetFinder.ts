import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { delay } from '../../common/common';
import Meta from '../../models/meta';
import Point, { PointAction } from '../../models/point';
import TwitterEngagement from '../../models/twitter_engagement';
import User from '../../models/user';
import { TwitterService } from '../../services/twitter.service';
import { Base } from '../base';

/**
 * MentionedTweetFinder finds tweet that has mentioned a specific term
 */
@Injectable()
export default class MentionedTweetFinder extends Base {
  private logger = new Logger(MentionedTweetFinder.name);

  constructor(private cfgSrv: ConfigService, private twitterSrv: TwitterService) {
    super();
    this.schedule();
  }

  @Cron('*/15 * * * *')
  schedule() {
    this.process().catch((e) => this.logger.error(e.message || 'failed to get exchange rate'));
  }

  async process() {
    if (this.isProcessing()) return;
    this.setProcessing(true);

    try {
      let newLastId: string;
      let nextToken: string;
      while (true) {
        const lastId = await Meta.get('mentionedTweetFinder:lastId');

        const result = await this.twitterSrv.search(
          '@0xJoint',
          lastId ? lastId.value : undefined,
          undefined,
          10,
          nextToken,
        );

        if (!newLastId) newLastId = result.meta.newest_id;

        if (result.meta.result_count) {
          this.logger.log(
            `Found ${result.meta.result_count} tweets (Newest ID: ${result.meta.newest_id}, Oldest ID: ${result.meta.oldest_id})`,
          );

          for (const tweet of result.data) {
            this.logger.log(`Processing tweet: ${tweet.id}`);

            const type = tweet.referenced_tweets ? tweet.referenced_tweets[0].type : 'tweet';
            const tweetOwner = await User.getByTwitterUserId(tweet.author_id);
            const referencedTweetId = tweet.referenced_tweets ? tweet.referenced_tweets[0].id : undefined;
            const existing = await TwitterEngagement.getByTypeAndTweetId(type, tweet.id);
            if (!existing) {
              await TwitterEngagement.create({
                tweetId: tweet.id,
                userId: tweetOwner?.id,
                twitterUserId: tweet.author_id,
                address: tweetOwner?.address,
                type: type,
                referencedTweetId,
              });
            }

            if (tweetOwner) {
              const name = `tweet-finder-${tweet.id}`;
              const existingPoint = await Point.getByName(name);
              if (!existingPoint) {
                let point = '0';
                if (type == 'tweet') point = this.cfgSrv.get('app.pointPerTweet');
                else if (type == 'quoted') point = this.cfgSrv.get('app.pointPerQuote');
                else if (type == 'replied_to') point = this.cfgSrv.get('app.pointPerReply');
                else if (type == 'retweeted') point = this.cfgSrv.get('app.pointPerRetweet');
                await Point.create({
                  name: `tweet-finder-${tweet.id}`,
                  address: tweetOwner?.address,
                  point: point,
                  action: PointAction.TweetSearch,
                });
              }
            }

            if (referencedTweetId) {
              const referencedEngagement = await TwitterEngagement.getByTweetId(referencedTweetId);
              if (referencedEngagement) {
                const referencedTweetOwner = await User.getByTwitterUserId(referencedEngagement.twitterUserId);
                if (!referencedTweetOwner || referencedTweetOwner.id == tweetOwner.id) {
                  continue;
                }

                const name = `tweet-finder-ref-${tweet.id}-${referencedTweetId}`;
                const existingPoint = await Point.getByName(name);
                if (!existingPoint) {
                  if (referencedTweetOwner) {
                    const point = this.cfgSrv.get('app.pointPerReference');
                    await Point.create({
                      name,
                      address: referencedTweetOwner?.address,
                      point: point,
                      action: PointAction.TweetSearch,
                    });
                  }
                }
              }
            }
          }
        } else {
          this.logger.log('No new tweet engagement found');
        }

        if (result.meta.next_token) {
          nextToken = result.meta.next_token;
          await delay(2000);
          continue;
        } else if (newLastId) {
          await Meta.update(`mentionedTweetFinder:lastId`, newLastId);
          break;
        } else {
          break;
        }
      }
    } catch (e) {
      this.logger.error(e.message);
      return e;
    } finally {
      this.setProcessing(false);
    }
  }
}
