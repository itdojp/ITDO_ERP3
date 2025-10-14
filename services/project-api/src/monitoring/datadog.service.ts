import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { StatsD } from 'hot-shots';
import HotShots from 'hot-shots';
import { MetricsEmitter } from '../../../../shared/ai/chat-summary';

@Injectable()
export class DatadogMetricsService implements MetricsEmitter {
  private readonly logger = new Logger(DatadogMetricsService.name);
  private readonly client?: StatsD;

  constructor(configService: ConfigService) {
    const host = configService.get<string>('DATADOG_AGENT_HOST');
    if (!host) {
      return;
    }
    const port = Number(configService.get<number>('DATADOG_AGENT_PORT') ?? 8125);
    this.client = new HotShots({
      host,
      port,
      globalTags: {
        service: configService.get<string>('DD_SERVICE') ?? 'project-api',
        env: configService.get<string>('DD_ENV') ?? 'development',
      },
      errorHandler: (error) => {
        this.logger.warn(`Datadog metrics error: ${error.message}`);
      },
    });
  }

  increment(metric: string, value = 1, tags: string[] = []) {
    if (!this.client) return;
    this.client.increment(metric, value, tags);
  }

  timing(metric: string, value: number, tags: string[] = []) {
    if (!this.client) return;
    this.client.timing(metric, value, tags);
  }
}
