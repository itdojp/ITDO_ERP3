/* eslint-disable @typescript-eslint/no-explicit-any */
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SalesService } from './service';
import { SalesMetricsService } from './metrics/sales-metrics.service';
import { PrismaService } from '../prisma/prisma.service';

type PrismaServiceMock = {
  quote: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
    aggregate?: jest.Mock;
    count?: jest.Mock;
  };
  order: {
    create: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
    findUnique: jest.Mock;
    aggregate?: jest.Mock;
  };
  creditReview: {
    create: jest.Mock;
    count: jest.Mock;
    findMany: jest.Mock;
  };
  orderAuditLog: {
    create: jest.Mock;
  };
  $transaction: jest.Mock;
};

type SalesMetricsServiceMock = {
  recordQuoteCreated: jest.Mock;
  recordQuoteApproved: jest.Mock;
  recordOrderCreated: jest.Mock;
  recordCreditReviewApproved: jest.Mock;
  syncPendingCreditCount: jest.Mock;
  snapshot: jest.Mock;
};

const quoteEntity = {
  id: 'quote-1',
  quoteNumber: 'Q-2025-0001',
  customerId: 'customer-1',
  status: 'PENDING_APPROVAL',
  totalAmount: 1000,
  currency: 'JPY',
  version: 1,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-02T00:00:00Z'),
  submittedAt: null,
  approvedAt: null,
  items: [],
  order: null,
};

const orderEntity = {
  id: 'order-1',
  orderNumber: 'SO-2025-0001',
  quoteId: 'quote-1',
  customerId: 'customer-1',
  status: 'PENDING',
  totalAmount: 1000,
  paymentTerm: 'Net 30',
  signedAt: null,
  createdAt: new Date('2025-01-03T00:00:00Z'),
  updatedAt: new Date('2025-01-03T00:00:00Z'),
  creditReviews: [],
};

describe('SalesService', () => {
  let prisma: PrismaServiceMock;
  let metrics: SalesMetricsServiceMock;
  let service: SalesService;

  beforeEach(() => {
    prisma = {
      quote: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue(quoteEntity),
        update: jest.fn().mockResolvedValue(quoteEntity),
        findMany: jest.fn(),
      },
      order: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue(orderEntity),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
      creditReview: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      orderAuditLog: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      $transaction: jest.fn(),
    };

    metrics = {
      recordQuoteCreated: jest.fn().mockResolvedValue(undefined),
      recordQuoteApproved: jest.fn().mockResolvedValue(undefined),
      recordOrderCreated: jest.fn().mockResolvedValue(undefined),
      recordCreditReviewApproved: jest.fn().mockResolvedValue(undefined),
      syncPendingCreditCount: jest.fn().mockResolvedValue(undefined),
      snapshot: jest.fn(),
    };

    service = new SalesService(prisma as unknown as PrismaService, metrics as unknown as SalesMetricsService);
  });

  describe('createQuote', () => {
    it('creates quote and records metrics', async () => {
      prisma.quote.create.mockResolvedValueOnce({
        ...quoteEntity,
        totalAmount: 1200,
      });

      const result = await service.createQuote({
        customerId: quoteEntity.customerId,
        items: [{ productCode: 'SKU', quantity: 2, unitPrice: 600, discountRate: 0 }],
      });

      expect(prisma.quote.create).toHaveBeenCalled();
      expect(metrics.recordQuoteCreated).toHaveBeenCalledWith(quoteEntity.customerId);
      expect(result.totalAmount).toBe(1200);
    });
  });

  describe('createOrder', () => {
    it('approves quote, creates order, and records metrics', async () => {
      prisma.quote.findUnique.mockResolvedValueOnce(quoteEntity as never);
      prisma.order.create.mockResolvedValueOnce(orderEntity as never);

      const result = await service.createOrder({
        quoteId: quoteEntity.id,
        paymentTerm: 'Net 30',
      });

      expect(prisma.quote.update).toHaveBeenCalledWith({
        where: { id: quoteEntity.id },
        data: expect.objectContaining({ status: 'APPROVED' }),
      });
      expect(metrics.recordQuoteApproved).toHaveBeenCalledWith(quoteEntity.customerId);
      expect(metrics.recordOrderCreated).toHaveBeenCalledWith(orderEntity.customerId);
      expect(metrics.syncPendingCreditCount).toHaveBeenCalled();
      expect(prisma.orderAuditLog.create).toHaveBeenCalled();
      expect(result.orderNumber).toBe(orderEntity.orderNumber);
    });

    it('throws when quote not found', async () => {
      prisma.quote.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.createOrder({ quoteId: 'missing', paymentTerm: 'Net 30' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('skips quote approval metric when already approved', async () => {
      prisma.quote.findUnique.mockResolvedValueOnce({
        ...quoteEntity,
        status: 'APPROVED',
        approvedAt: new Date('2025-01-01T01:00:00Z'),
      } as never);
      prisma.order.create.mockResolvedValueOnce(orderEntity as never);

      await service.createOrder({
        quoteId: quoteEntity.id,
        paymentTerm: 'Net 30',
      });

      expect(metrics.recordQuoteApproved).not.toHaveBeenCalled();
    });
  });

  describe('approveCreditReview', () => {
    it('creates credit review, updates order status, records metrics', async () => {
      prisma.order.findUnique.mockResolvedValueOnce(orderEntity as never);
      prisma.creditReview.create.mockResolvedValueOnce({
        id: 'cr-1',
        orderId: orderEntity.id,
        status: 'APPROVED',
        score: 90,
        remarks: null,
        requestedAt: new Date(),
        decidedAt: new Date(),
      } as never);

      const result = await service.approveCreditReview({
        orderId: orderEntity.id,
        score: 90,
      });

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: orderEntity.id },
        data: { status: 'FULFILLED' },
      });
      expect(metrics.recordCreditReviewApproved).toHaveBeenCalledWith(orderEntity.customerId);
      expect(metrics.syncPendingCreditCount).toHaveBeenCalled();
      expect(prisma.orderAuditLog.create).toHaveBeenCalled();
      expect(result.status).toBe('APPROVED');
    });

    it('throws when order not found', async () => {
      prisma.order.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.approveCreditReview({ orderId: 'missing', score: 70 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMetrics', () => {
    it('delegates to metrics service', async () => {
      const snapshot = {
        generatedAt: new Date(),
        totalQuotes: 3,
        quotesDraft: 1,
        quotesPendingApproval: 1,
        quotesApproved: 1,
        averageQuoteValue: 100,
        totalQuoteValue: 300,
        totalOrders: 2,
        ordersPendingFulfillment: 1,
        ordersFulfilled: 1,
        totalOrderValue: 200,
        quoteToOrderConversionRate: 0.67,
        pendingCreditReviews: 1,
        averageCreditApprovalTimeHours: 12,
      };
      metrics.snapshot.mockResolvedValueOnce(snapshot as never);

      const result = await service.getMetrics();

      expect(metrics.snapshot).toHaveBeenCalled();
      expect(result).toEqual(snapshot);
    });
  });
});

describe('SalesMetricsService', () => {
  let prisma: {
    quote: {
      aggregate: jest.Mock;
      count: jest.Mock;
    };
    order: {
      aggregate: jest.Mock;
      count: jest.Mock;
    };
    creditReview: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let config: { get: jest.Mock };
  let service: SalesMetricsService;

  beforeEach(() => {
    prisma = {
      quote: {
        aggregate: jest.fn(),
        count: jest.fn(),
      },
      order: {
        aggregate: jest.fn(),
        count: jest.fn(),
      },
      creditReview: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (promises: Promise<unknown>[]) => Promise.all(promises)),
    };
    config = {
      get: jest.fn((key: string) => {
        switch (key) {
          case 'SALES_METRICS_NAMESPACE':
            return 'ITDO/Sales';
          case 'SALES_METRICS_ENV':
            return 'test';
          case 'SALES_METRICS_ENABLED':
            return 'false';
          default:
            return undefined;
        }
      }),
    };
    service = new SalesMetricsService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
    );
  });

  it('builds metrics snapshot from prisma aggregates', async () => {
    const generatedAt = new Date();
    prisma.quote.aggregate.mockResolvedValueOnce({
      _count: { _all: 4 },
      _sum: { totalAmount: 4000 },
      _avg: { totalAmount: 1000 },
    });
    prisma.quote.count.mockResolvedValueOnce(1);
    prisma.quote.count.mockResolvedValueOnce(1);
    prisma.quote.count.mockResolvedValueOnce(2);
    prisma.order.aggregate.mockResolvedValueOnce({
      _count: { _all: 3 },
      _sum: { totalAmount: 3000 },
    });
    prisma.order.count.mockResolvedValueOnce(1);
    prisma.creditReview.count.mockResolvedValueOnce(2);
    prisma.creditReview.findMany.mockResolvedValueOnce([
      {
        requestedAt: new Date(generatedAt.getTime() - 4 * 3_600_000),
        decidedAt: new Date(generatedAt.getTime() - 1 * 3_600_000),
      },
    ]);

    const snapshot = await service.snapshot();

    expect(snapshot.totalQuotes).toBe(4);
    expect(snapshot.totalOrders).toBe(3);
    expect(snapshot.ordersPendingFulfillment).toBe(2);
    expect(snapshot.pendingCreditReviews).toBe(2);
    expect(snapshot.averageCreditApprovalTimeHours).toBeCloseTo(3);
  });

  it('publishes pending credit count when CloudWatch client is set', async () => {
    prisma.order.count.mockResolvedValueOnce(5);
    (service as any).enabled = true;
    (service as any).client = {
      send: jest.fn().mockResolvedValue(undefined),
    };

    await service.syncPendingCreditCount();

    expect(prisma.order.count).toHaveBeenCalledWith({ where: { status: 'PENDING' } });
    expect((service as any).client.send).toHaveBeenCalled();
  });
});
