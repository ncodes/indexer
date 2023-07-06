import { Module } from '@nestjs/common';
import { OfferController } from './offers.controller';
import { OfferService } from './offer.service';

@Module({
  imports: [],
  controllers: [OfferController],
  providers: [OfferService],
})
export class OffersModule {}
