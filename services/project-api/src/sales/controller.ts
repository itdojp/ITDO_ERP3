import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { SalesService } from './service';
import { ApproveCreditReviewInput, CreditReviewModel } from './dto/credit-review.dto';
import { CreateOrderInput, OrderModel } from './dto/order.dto';
import { CreateQuoteInput, QuoteModel } from './dto/quote.dto';

@Controller('api/v1/sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get('quotes')
  listQuotes(
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
  ): Promise<QuoteModel[]> {
    const filter = customerId || status ? { customerId, status } : undefined;
    return this.salesService.listQuotes(filter);
  }

  @Post('quotes')
  createQuote(@Body() input: CreateQuoteInput): Promise<QuoteModel> {
    return this.salesService.createQuote(input);
  }

  @Get('orders')
  listOrders(@Query('customerId') customerId?: string): Promise<OrderModel[]> {
    return this.salesService.listOrders(customerId);
  }

  @Post('orders')
  createOrder(@Body() input: CreateOrderInput): Promise<OrderModel> {
    return this.salesService.createOrder(input);
  }

  @Post('orders/:orderId/credit-review')
  approveCreditReview(
    @Param('orderId') orderId: string,
    @Body() body: ApproveCreditReviewInput,
  ): Promise<CreditReviewModel> {
    return this.salesService.approveCreditReview({ ...body, orderId });
  }
}
