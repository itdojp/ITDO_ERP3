import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BillingController } from './contract-events.controller';
import { DocuSignWebhookController } from './docusign.controller';
import { InvoiceQueueService } from './invoice-queue.service';
import { InvoiceProcessorService } from './invoice-processor.service';
import { ContractAutomationService } from './contract-automation.service';
import { DatadogMetricsService } from '../monitoring/datadog.service';

@Module({
  imports: [ConfigModule],
  providers: [InvoiceQueueService, InvoiceProcessorService, ContractAutomationService, DatadogMetricsService],
  controllers: [BillingController, DocuSignWebhookController],
  exports: [ContractAutomationService, InvoiceQueueService],
})
export class BillingModule {}
