import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SalesService } from './service';
import { QuoteModel, CreateQuoteInput, QuoteFilterInput } from './dto/quote.dto';
import { OrderModel, CreateOrderInput } from './dto/order.dto';
import { CreditReviewModel, ApproveCreditReviewInput } from './dto/credit-review.dto';

@Resolver(() => QuoteModel)
export class SalesResolver {
  constructor(private readonly service: SalesService) {}

  @Query(() => [QuoteModel])
  quotes(@Args('filter', { nullable: true }) filter?: QuoteFilterInput): Promise<QuoteModel[]> {
    return this.service.listQuotes(filter);
  }

  @Query(() => [OrderModel])
  orders(@Args('customerId', { nullable: true }) customerId?: string): Promise<OrderModel[]> {
    return this.service.listOrders(customerId);
  }

  @Mutation(() => QuoteModel)
  createQuote(@Args('input') input: CreateQuoteInput): Promise<QuoteModel> {
    return this.service.createQuote(input);
  }

  @Mutation(() => OrderModel)
  createOrder(@Args('input') input: CreateOrderInput): Promise<OrderModel> {
    return this.service.createOrder(input);
  }

  @Mutation(() => CreditReviewModel)
  approveCreditReview(
    @Args('input') input: ApproveCreditReviewInput,
  ): Promise<CreditReviewModel> {
    return this.service.approveCreditReview(input);
  }
}
