import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApproveCreditReviewInput, CreditReviewModel } from './dto/credit-review.dto';
import { CreateOrderInput, OrderModel } from './dto/order.dto';
import { CreateQuoteInput, QuoteFilterInput, QuoteModel } from './dto/quote.dto';

interface QuoteItemEntity {
  id: string;
  productCode: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  discountRate: number;
}

interface CreditReviewEntity {
  id: string;
  orderId: string;
  status: string;
  score: number | null;
  remarks: string | null;
  requestedAt: Date;
  decidedAt: Date | null;
}

interface OrderEntity {
  id: string;
  orderNumber: string;
  quoteId: string;
  customerId: string;
  status: string;
  totalAmount: number;
  paymentTerm: string;
  signedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  creditReviews: CreditReviewEntity[];
}

interface QuoteEntity {
  id: string;
  quoteNumber: string;
  customerId: string;
  status: string;
  totalAmount: number;
  currency: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date | null;
  approvedAt: Date | null;
  items: QuoteItemEntity[];
  order: OrderEntity | null;
}

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly quoteInclude = {
    items: true,
    order: {
      include: {
        creditReviews: {
          orderBy: { requestedAt: 'desc' },
        },
      },
    },
  } satisfies Prisma.QuoteInclude;

  private readonly orderInclude = {
    creditReviews: {
      orderBy: { requestedAt: 'desc' },
    },
  } satisfies Prisma.OrderInclude;

  async listQuotes(filter?: QuoteFilterInput): Promise<QuoteModel[]> {
    const where: Prisma.QuoteWhereInput = {};
    if (filter?.customerId) {
      where.customerId = filter.customerId;
    }
    if (filter?.status) {
      where.status = filter.status;
    }

    const quotes = await this.prisma.quote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: this.quoteInclude,
    });

    return (quotes as QuoteEntity[]).map((quote) => this.mapQuote(quote));
  }

  async createQuote(input: CreateQuoteInput): Promise<QuoteModel> {
    const totalAmount = this.calculateTotalAmount(input.items);

    const quote = await this.prisma.quote.create({
      data: {
        quoteNumber: input.quoteNumber ?? this.generateQuoteNumber(),
        customerId: input.customerId,
        status: 'DRAFT',
        currency: input.currency ?? 'JPY',
        totalAmount,
        items: {
          create: input.items.map((item) => ({
            productCode: item.productCode,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountRate: item.discountRate,
          })),
        },
      },
      include: this.quoteInclude,
    });

    return this.mapQuote(quote as QuoteEntity);
  }

  async createOrder(input: CreateOrderInput): Promise<OrderModel> {
    const quote = await this.prisma.quote.findUnique({ where: { id: input.quoteId } });

    if (!quote) {
      throw new NotFoundException(`Quote ${input.quoteId} not found`);
    }

    const order = await this.prisma.order.create({
      data: {
        orderNumber: input.orderNumber ?? this.generateOrderNumber(),
        quoteId: quote.id,
        customerId: quote.customerId,
        status: 'PENDING',
        paymentTerm: input.paymentTerm,
        signedAt: input.signedAt ?? null,
        totalAmount: input.totalAmount ?? quote.totalAmount,
      },
      include: this.orderInclude,
    });

    await this.prisma.orderAuditLog.create({
      data: {
        orderId: order.id,
        changeType: 'order.created',
        payload: JSON.stringify({ orderNumber: order.orderNumber, totalAmount: order.totalAmount }),
        checksum: `order-created-${order.id}`,
      },
    }).catch(() => undefined);

    return this.mapOrder(order as OrderEntity);
  }

  async approveCreditReview(input: ApproveCreditReviewInput): Promise<CreditReviewModel> {
    const order = await this.prisma.order.findUnique({ where: { id: input.orderId } });
    if (!order) {
      throw new NotFoundException(`Order ${input.orderId} not found`);
    }

    const review = await this.prisma.creditReview.create({
      data: {
        orderId: order.id,
        status: 'APPROVED',
        score: input.score,
        remarks: input.remarks ?? null,
        decidedAt: new Date(),
      },
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: 'FULFILLED' },
    });

    await this.prisma.orderAuditLog.create({
      data: {
        orderId: order.id,
        changeType: 'credit-review',
        payload: JSON.stringify({ score: input.score, remarks: input.remarks ?? null }),
        checksum: `credit-review-${order.id}-${review.id}`,
      },
    }).catch(() => undefined);

    return this.mapCreditReview(review as CreditReviewEntity);
  }

  async listOrders(customerId?: string): Promise<OrderModel[]> {
    const orders = await this.prisma.order.findMany({
      where: customerId ? { customerId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: this.orderInclude,
    });

    return (orders as OrderEntity[]).map((order) => this.mapOrder(order));
  }

  private mapQuote(entity: QuoteEntity): QuoteModel {
    return {
      id: entity.id,
      quoteNumber: entity.quoteNumber,
      customerId: entity.customerId,
      status: entity.status,
      totalAmount: entity.totalAmount,
      currency: entity.currency,
      version: entity.version,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      submittedAt: entity.submittedAt ?? undefined,
      approvedAt: entity.approvedAt ?? undefined,
      items: entity.items.map((item) => ({
        id: item.id,
        productCode: item.productCode,
        description: item.description ?? undefined,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountRate: item.discountRate,
      })),
      order: entity.order ? this.mapOrder(entity.order) : undefined,
      creditReviews: entity.order ? entity.order.creditReviews.map((review) => this.mapCreditReview(review)) : [],
    };
  }

  private mapOrder(entity: OrderEntity): OrderModel {
    return {
      id: entity.id,
      orderNumber: entity.orderNumber,
      quoteId: entity.quoteId,
      customerId: entity.customerId,
      status: entity.status,
      totalAmount: entity.totalAmount,
      paymentTerm: entity.paymentTerm,
      signedAt: entity.signedAt ?? undefined,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      creditReviews: entity.creditReviews.map((review) => this.mapCreditReview(review)),
    };
  }

  private mapCreditReview(entity: CreditReviewEntity): CreditReviewModel {
    return {
      id: entity.id,
      orderId: entity.orderId,
      status: entity.status,
      score: entity.score ?? undefined,
      remarks: entity.remarks ?? undefined,
      requestedAt: entity.requestedAt,
      decidedAt: entity.decidedAt ?? undefined,
    };
  }

  private calculateTotalAmount(items: CreateQuoteInput['items']): number {
    return items.reduce((total, item) => {
      const discount = item.discountRate ?? 0;
      const line = item.unitPrice * item.quantity * (1 - discount);
      return total + line;
    }, 0);
  }

  private generateQuoteNumber(): string {
    return `Q-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private generateOrderNumber(): string {
    return `SO-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }
}
