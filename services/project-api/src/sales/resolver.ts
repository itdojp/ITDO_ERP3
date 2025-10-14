import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SalesService } from './service';
import { QuoteModel, CreateQuoteInput, QuoteFilterInput } from './dto/quote.dto';
import { OrderModel, CreateOrderInput } from './dto/order.dto';
import { CreditReviewModel, ApproveCreditReviewInput } from './dto/credit-review.dto';
import { SalesMetricsModel } from './metrics/sales-metrics.model';

@Resolver(() => QuoteModel)
export class SalesResolver {
  constructor(private readonly salesService: SalesService) {}

  @Query(() => [QuoteModel])
  quotes(@Args('filter', { nullable: true }) filter?: QuoteFilterInput): Promise<QuoteModel[]> {
    return this.salesService.listQuotes(filter);
  }

  @Query(() => [OrderModel])
  orders(@Args('customerId', { nullable: true }) customerId?: string): Promise<OrderModel[]> {
    return this.salesService.listOrders(customerId);
  }

  @Mutation(() => QuoteModel)
  createQuote(@Args('input') input: CreateQuoteInput): Promise<QuoteModel> {
    return this.salesService.createQuote(input);
  }

  @Mutation(() => OrderModel)
  createOrder(@Args('input') input: CreateOrderInput): Promise<OrderModel> {
    return this.salesService.createOrder(input);
  }

  @Query(() => SalesMetricsModel)
  salesMetrics(): Promise<SalesMetricsModel> {
    return this.salesService.getMetrics();
  }

  @Mutation(() => CreditReviewModel)
  approveCreditReview(
    @Args('input') input: ApproveCreditReviewInput,
  ): Promise<CreditReviewModel> {
    return this.salesService.approveCreditReview(input);
  }
}
