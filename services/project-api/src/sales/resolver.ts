import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SalesService } from './service';
import { QuoteModel, CreateQuoteInput } from './dto/quote.dto';
import { OrderModel, CreateOrderInput } from './dto/order.dto';
import { CreditReviewModel, ApproveCreditReviewInput } from './dto/credit-review.dto';

@Resolver(() => QuoteModel)
export class SalesResolver {
  constructor(private readonly service: SalesService) {}

  @Query(() => [QuoteModel])
  quotes(): QuoteModel[] {
    return this.service.listQuotes();
  }

  @Mutation(() => QuoteModel)
  createQuote(@Args('input') input: CreateQuoteInput): QuoteModel {
    return this.service.createQuote(input);
  }

  @Mutation(() => OrderModel)
  createOrder(@Args('input') input: CreateOrderInput): OrderModel {
    return this.service.createOrder(input);
  }

  @Mutation(() => CreditReviewModel)
  approveCreditReview(
    @Args('input') input: ApproveCreditReviewInput,
  ): CreditReviewModel {
    return this.service.approveCreditReview(input);
  }
}
