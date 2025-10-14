import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { Injectable, Logger } from '@nestjs/common';

interface MetricDimensions {
  name: string;
  value: string;
}

@Injectable()
export class SalesMetricsService {
  private readonly logger = new Logger(SalesMetricsService.name);
  private readonly namespace: string;
  private readonly enabled: boolean;
  private readonly client: CloudWatchClient | null;

  constructor() {
    this.enabled = process.env.SALES_METRICS_ENABLED === 'true';
    this.namespace = process.env.SALES_METRICS_NAMESPACE ?? 'ITDO/Sales';
    this.client = this.enabled
      ? new CloudWatchClient({ region: process.env.AWS_REGION ?? 'ap-northeast-1' })
      : null;

    if (!this.enabled) {
      this.logger.log('Sales metrics disabled (set SALES_METRICS_ENABLED=true to enable).');
    }
  }

  async recordMetric(metricName: string, value: number, dimensions: MetricDimensions[] = []): Promise<void> {
    if (!this.enabled || !this.client) {
      return;
    }

    try {
      await this.client.send(
        new PutMetricDataCommand({
          Namespace: this.namespace,
          MetricData: [
            {
              MetricName: metricName,
              Value: value,
              Unit: 'Count',
              Dimensions: dimensions.map((dimension) => ({
                Name: dimension.name,
                Value: dimension.value,
              })),
            },
          ],
        }),
      );
    } catch (error) {
      this.logger.warn(`Failed to publish metric ${metricName}: ${(error as Error).message}`);
    }
  }

  quoteCreated(environment: string): Promise<void> {
    return this.recordMetric('QuoteCreatedCount', 1, [{ name: 'Environment', value: environment }]);
  }

  orderCreated(environment: string): Promise<void> {
    return this.recordMetric('OrderCreatedCount', 1, [{ name: 'Environment', value: environment }]);
  }

  creditReviewPending(environment: string): Promise<void> {
    return this.recordMetric('CreditPendingCount', 1, [{ name: 'Environment', value: environment }]);
  }

  creditReviewApproved(environment: string): Promise<void> {
    return this.recordMetric('CreditApprovedCount', 1, [{ name: 'Environment', value: environment }]);
  }
}
