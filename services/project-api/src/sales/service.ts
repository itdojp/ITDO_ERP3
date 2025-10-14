import { Injectable } from '@nestjs/common';
import { ApproveCreditReviewInput, CreditReviewModel } from './dto/credit-review.dto';
import { CreateOrderInput, OrderModel } from './dto/order.dto';
import { CreateQuoteInput, QuoteModel } from './dto/quote.dto';

@Injectable()
export class SalesService {
  listQuotes(): QuoteModel[] {
    return [];
  }

  createQuote(input: CreateQuoteInput): QuoteModel {
    return {
      id: 'new-quote',
      quoteNumber: 'Q-0000',
      customerId: input.customerId,
      status: 'Draft',
      totalAmount: input.items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0),
      items: input.items.map((item, index) => ({
        id: `item-${index}`,
        productCode: item.productCode,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountRate: item.discountRate,
      })),
    };
  }

  createOrder(input: CreateOrderInput): OrderModel {
    return {
      id: 'new-order',
      orderNumber: 'O-0000',
      quoteId: input.quoteId,
      status: 'Pending',
      totalAmount: input.totalAmount,
    };
  }

  approveCreditReview(input: ApproveCreditReviewInput): CreditReviewModel {
    return {
      id: 'credit-review',
      orderId: input.orderId,
      status: 'Approved',
      score: input.score,
      remarks: input.remarks,
    };
  }
}
