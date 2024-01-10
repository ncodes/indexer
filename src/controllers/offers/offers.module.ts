import { Module } from '@nestjs/common';
import { NetworkModule } from '../../network/network.module';
import { MetadataService } from '../../services/metadata/metadata.service';
import { RedisModule } from '../../services/redis/redis.module';
import { MarketService } from '../markets/market.service';
import { OfferService } from './offer.service';
import { OfferController } from './offers.controller';

@Module({
  imports: [NetworkModule, RedisModule],
  controllers: [OfferController],
  providers: [OfferService, MarketService, MetadataService],
})
export class OffersModule {}
