import { Module } from '@nestjs/common';
import { OfferController } from './offers.controller';
import { OfferService } from './offer.service';
import { MarketService } from '../markets/market.service';
import { MetadataService } from '../../services/metadata/metadata.service';
import { NetworkModule } from '../../network/network.module';
import { RedisService } from '../../services/redis.service';

@Module({
  imports: [NetworkModule],
  controllers: [OfferController],
  providers: [OfferService, MarketService, MetadataService, RedisService],
})
export class OffersModule {}
