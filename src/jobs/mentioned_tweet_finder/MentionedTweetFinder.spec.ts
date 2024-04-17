import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { NoopLogger } from '../../common/loggers/noop_logger';
import { DBService } from '../../db/db.service';
import { TwitterService } from '../../services/twitter.service';
import MentionedTweetFinder from './MentionedTweetFinder';

describe('MentionedTweetFinder', () => {
  let app: INestApplication;
  const db = DBService.getForTest();
  let job: MentionedTweetFinder;

  afterEach(async () => {
    await db.truncateTables();
  });

  afterAll(async () => {
    await db.destroy();
    await app.close();
  });

  beforeEach(async () => {
    await db.truncateTables();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ConfigService, MentionedTweetFinder, TwitterService],
    }).compile();

    app = module.createNestApplication();
    app.useLogger(new NoopLogger());
    job = app.get<MentionedTweetFinder>(MentionedTweetFinder);
    await app.init();
  });

  describe('.process', () => {
    it('should return undefined if job is already processing', async () => {
      job.setProcessing(true);
      await expect(job.process()).resolves.toBeUndefined();
    });
  });
});
