import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { CreateDTO, ListQueryDTO } from './dto';
import Swap from '../../models/swap';
import { ErrorTypes, ok, throw400, throw401, throw404 } from '../../common/responses/responses';
import express from 'express';
import Review from '../../models/reviews';
import Liquidity from '../../models/liquidity';
import { transaction } from 'objection';

@UseGuards(BeAuthenticatedGuard)
@UseGuards(HasKeyGuard)
@Controller('v1/reviews')
export class ReviewsController {
  /**
   * Create a review
   * @param req The request object
   * @param body The review body
   * @param swapId The swap ID
   */
  @Post('/:swapId')
  async create(
    @Req() req: express.Request,
    @Body(new ValidationPipe(ValPipeOpt)) body: CreateDTO,
    @Param('swapId') swapId: string,
  ) {
    // Ensure swap exists
    const swap = await Swap.getById(swapId);
    if (!swap) throw404('swap order not found', ErrorTypes.InvalidRequest, 'swapId');

    // Ensure auth user is a provider or taker
    if (![swap.provider, swap.taker].includes(req.user.address))
      throw401('not a participant', ErrorTypes.InvalidRequest);

    // Ensure only swap that has been cancelled or reviewed are allowed
    if (!swap.released && !swap.cancelled)
      throw400('not ready for review', ErrorTypes.InvalidRequest);

    // Ensure user has not previously created a review for the swap
    const reviewed = swap.provider === req.user.address ? swap.taker : swap.provider;
    if (await Review.isSwapReviewed(req.user.id, swapId))
      throw400('cannot review same swap multiple time');

    let review: Review;
    await transaction(Review, Liquidity, async (Review, Liquidity, trx) => {
      // Create a review
      review = await Review.create(
        {
          network: swap.network,
          marketId: swap.marketId,
          reviewerId: req.user.id,
          reviewed,
          swapId,
          satisfied: body.satisfied,
          comment: body.comment,
        },
        trx,
      );

      // Compute and update satisfactory rate for liquidities
      // owned by the swap provider (if any)
      if (reviewed === swap.provider) {
        await Liquidity.updateProviderLiquidities(
          swap.network,
          swap.provider,
          { satisfactoryRate: await Review.getSatisfactoryRate(reviewed, trx) },
          trx,
        );
      }
    });

    return ok().data(review).build<Review>();
  }

  /**
   * List reviews targeted at an address
   * @param reviewedAddress The address whose reviews are wanted
   * @param q The query parameters
   *  - [network] The network name.
   *  - [count] Returns the count of matching result
   *  - [limit] The number of result to return (optional)
   *  - [offset] The query offset (optional)
   */
  @Get('/:reviewedAddress')
  async listReviews(
    @Param('reviewedAddress') reviewedAddress: string,
    @Query(new ValidationPipe(ValPipeOpt)) q: ListQueryDTO,
  ) {
    if (!q.count) {
      return ok()
        .data(await Review.searchReviews(q.net, reviewedAddress, q.limit || 25, q.offset))
        .build<Review>();
    } else {
      return ok()
        .data({ count: await Review.countReviews(q.net, reviewedAddress) })
        .build();
    }
  }

  /**
   * Get the review stats of an address
   * @param reviewed The address whose review stat is wanted
   */
  @Get('/:reviewedAddress/stats')
  async getStats(@Param('reviewedAddress') reviewed: string) {
    const numReceivedReviews = await Review.countReceived(reviewed);
    const numSatisfiedReceived = await Review.countSatisfiedReceived(reviewed);
    const sr = (numSatisfiedReceived / numReceivedReviews) * 100 || 0;
    return ok()
      .data({
        numReceivedReviews,
        numSatisfiedReceived,
        satisfactoryRate: sr,
      })
      .build();
  }
}
