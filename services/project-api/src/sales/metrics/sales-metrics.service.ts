import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SalesMetricsModel, SalesMetricsSnapshot } from './sales-metrics.model';

type Nullable<T> = T | null | undefined;

@Injectable()
export class SalesMetricsService {
  private readonly logger = new Logger(SalesMetricsService.name);
  private readonly namespace: string;
  private readonly environment: string;
  private readonly enabled: boolean;
  private client?: CloudWatchClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.namespace = this.configService.get<string>('SALES_METRICS_NAMESPACE') ?? 'ITDO/Sales';
    this.environment =
      this.configService.get<string>('SALES_METRICS_ENV') ??
      this.configService.get<string>('APP_ENVIRONMENT') ??
      this.configService.get<string>('DD_ENV') ??
      this.configService.get<string>('NODE_ENV') ??
      process.env.SALES_METRICS_ENV ??
      process.env.NODE_ENV ??
      'development';
    this.enabled = (this.configService.get<string>('SALES_METRICS_ENABLED') ?? 'false') === 'true';
    this.initializeClient();
  }

  async recordQuoteCreated(customerId: string): Promise<void> {
    await this.publishMetric('QuoteCreatedCount', 1, { CustomerId: customerId });
  }

  async recordQuoteApproved(customerId: string): Promise<void> {
    await this.publishMetric('QuoteApprovedCount', 1, { CustomerId: customerId });
  }

  async recordOrderCreated(customerId: string): Promise<void> {
    await this.publishMetric('OrderCreatedCount', 1, { CustomerId: customerId });
  }

  async recordCreditReviewApproved(customerId: string): Promise<void> {
    await this.publishMetric('CreditApprovedCount', 1, { CustomerId: customerId });
  }

  async syncPendingCreditCount(): Promise<void> {
    const pendingOrders = await this.prisma.order.count({
      where: { status: 'PENDING' },
    });
    await this.publishMetric('CreditPendingCount', pendingOrders);
  }

  async snapshot(): Promise<SalesMetricsSnapshot> {
    const [
      quoteAggregate,
      quotesDraft,
      quotesPendingApproval,
      quotesApproved,
      ordersAggregate,
      ordersFulfilled,
      pendingCreditReviews,
      approvedCreditReviews,
    ] = await this.prisma.$transaction([
      this.prisma.quote.aggregate({
        _count: { _all: true },
        _sum: { totalAmount: true },
        _avg: { totalAmount: true },
      }),
      this.prisma.quote.count({ where: { status: 'DRAFT' } }),
      this.prisma.quote.count({ where: { status: 'PENDING_APPROVAL' } }),
      this.prisma.quote.count({ where: { status: 'APPROVED' } }),
      this.prisma.order.aggregate({
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.count({ where: { status: 'FULFILLED' } }),
      this.prisma.creditReview.count({ where: { status: 'REQUESTED' } }),
      this.prisma.creditReview.findMany({
        where: {
          status: 'APPROVED',
          decidedAt: { not: null },
        },
        select: {
          requestedAt: true,
          decidedAt: true,
        },
      }),
    ]);

    const totalQuotes = quoteAggregate._count._all ?? 0;
    const averageQuoteValue = normalizedNumber(quoteAggregate._avg.totalAmount);
    const totalQuoteValue = normalizedNumber(quoteAggregate._sum.totalAmount);
    const totalOrders = ordersAggregate._count._all ?? 0;
    const totalOrderValue = normalizedNumber(ordersAggregate._sum.totalAmount);
    const ordersPendingFulfillment = Math.max(0, totalOrders - ordersFulfilled);

    let averageCreditApprovalTimeHours: number | undefined;
    if (approvedCreditReviews.length > 0) {
      const totalDurationMs = approvedCreditReviews.reduce((acc, review) => {
        const decidedAt = review.decidedAt ?? new Date();
        const requestedAt = review.requestedAt ?? new Date();
        return acc + Math.max(0, decidedAt.getTime() - requestedAt.getTime());
      }, 0);
      averageCreditApprovalTimeHours = roundToTwoDecimals(
        totalDurationMs / approvedCreditReviews.length / 3_600_000,
      );
    }

    const quoteToOrderConversionRate =
      totalQuotes > 0 ? roundToTwoDecimals(totalOrders / totalQuotes) : undefined;

    const snapshot: SalesMetricsModel = {
      generatedAt: new Date(),
      totalQuotes,
      quotesDraft,
      quotesPendingApproval,
      quotesApproved,
      averageQuoteValue,
      totalQuoteValue,
      totalOrders,
      ordersPendingFulfillment,
      ordersFulfilled,
      totalOrderValue,
      quoteToOrderConversionRate,
      pendingCreditReviews,
      averageCreditApprovalTimeHours,
    };
    return snapshot;
  }

  private initializeClient(): void {
    if (!this.enabled) {
      this.logger.debug('Sales metrics disabled (set SALES_METRICS_ENABLED=true to enable CloudWatch).');
      return;
    }

    const region = this.configService.get<string>('AWS_REGION') ?? process.env.AWS_REGION;
    if (!region) {
      this.logger.warn('AWS region not configured, CloudWatch metrics disabled.');
      return;
    }

    this.client = new CloudWatchClient({ region });
  }

  private async publishMetric(metricName: string, value: number, dimensions: Record<string, string> = {}) {
    if (!this.enabled || !this.client) {
      return;
    }

    const command = new PutMetricDataCommand({
      Namespace: this.namespace,
      MetricData: [
        {
          MetricName: metricName,
          Value: value,
          Unit: 'Count',
          Timestamp: new Date(),
          Dimensions: Object.entries({
            Environment: this.environment,
            ...dimensions,
          }).map(([Name, Value]) => ({ Name, Value })),
        },
      ],
    });

    try {
      await this.client.send(command);
    } catch (error) {
      this.logger.warn(`Failed to publish metric ${metricName}: ${(error as Error).message}`);
    }
  }
}

function normalizedNumber(value: Nullable<Prisma.Decimal | number>): number {
  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return 0;
}

function roundToTwoDecimals(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return Math.round(value * 100) / 100;
}
