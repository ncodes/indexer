import { Test, TestingModule } from '@nestjs/testing';
import { WatcherService } from './watcher.service';

describe('WatcherService', () => {
  let service: WatcherService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WatcherService],
    }).compile();

    service = module.get<WatcherService>(WatcherService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
