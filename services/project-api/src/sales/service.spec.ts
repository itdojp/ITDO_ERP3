/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Test } from '@nestjs/testing';
import { SalesService } from './service';
import { SalesMetricsService } from './metrics/sales-metrics.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock: any = {
  quote: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  order: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  creditReview: {
    create: jest.fn(),
  },
};

describe('SalesService', () => {
  let service: SalesService;
  const metricsMock: any = {
    quoteCreated: jest.fn(),
    orderCreated: jest.fn(),
    creditReviewPending: jest.fn(),
    creditReviewApproved: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SalesMetricsService, useValue: metricsMock },
      ],
    }).compile();

    service = module.get(SalesService);
  });

  it('records metrics when creating quote', async () => {
    prismaMock.quote.create.mockResolvedValue({
      id: 'quote-1',
      quoteNumber: 'Q-2025-XXXX',
      customerId: 'cust-1',
      status: 'DRAFT',
      currency: 'JPY',
      totalAmount: 100,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      submittedAt: null,
      approvedAt: null,
      items: [],
      order: null,
    });

    await service.createQuote({
      customerId: 'cust-1',
      items: [{ productCode: 'SKU', quantity: 1, unitPrice: 100, discountRate: 0 }],
    });

    expect(metricsMock.quoteCreated).toHaveBeenCalled();
  });
});
