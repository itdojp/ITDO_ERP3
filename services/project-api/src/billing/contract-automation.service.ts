import { Injectable, Logger } from '@nestjs/common';
import type { ContractEventPayload } from '../../../../shared/contracts/lifecycle';
import { InvoiceQueueService } from './invoice-queue.service';

export interface ContractInvoiceJob {
  contractId: string;
  contractCode: string;
  eventType: ContractEventPayload['type'];
  customerEmail?: string;
}

@Injectable()
export class ContractAutomationService {
  private readonly logger = new Logger(ContractAutomationService.name);

  constructor(private readonly invoiceQueue: InvoiceQueueService) {}

  async handleContractEvent(event: ContractEventPayload & { contractId?: string; contractCode?: string; customerEmail?: string }) {
    this.logger.log(`Received contract event ${event.type} for contract ${event.contractId ?? 'unknown'}`);
    if (event.type === 'SIGNED' || event.type === 'ACTIVATED') {
      await this.enqueueInvoiceJob(event);
    }
  }

  async enqueueInvoiceJob(event: { contractId?: string; contractCode?: string; type: ContractEventPayload['type']; customerEmail?: string }) {
    if (!event.contractId || !event.contractCode) {
      this.logger.warn('Contract event missing identifiers, skipping invoice generation');
      return;
    }
    await this.invoiceQueue.enqueue({
      contractId: event.contractId,
      contractCode: event.contractCode,
      eventType: event.type,
      customerEmail: event.customerEmail,
    });
  }
}
