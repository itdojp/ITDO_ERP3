import { Body, Controller, Post } from '@nestjs/common';
import type { ContractEventPayload } from '../../../../shared/contracts/lifecycle';
import { ContractAutomationService } from './contract-automation.service';
import { InvoiceQueueService } from './invoice-queue.service';
import { ReplayInvoiceDto } from './dto/replay.dto';

@Controller('billing/contracts')
export class BillingController {
  constructor(private readonly automation: ContractAutomationService, private readonly queue: InvoiceQueueService) {}

  @Post('events')
  async handleEvent(@Body() payload: ContractEventPayload & { contractId?: string; contractCode?: string; customerEmail?: string }) {
    await this.automation.handleContractEvent(payload);
    await this.queue.waitForIdle();
    return { status: 'accepted' };
  }

  @Post('replay')
  async replay(@Body() payload: ReplayInvoiceDto) {
    await this.automation.enqueueInvoiceJob({
      contractId: payload.contractId,
      contractCode: payload.contractCode,
      type: payload.eventType,
      customerEmail: payload.customerEmail,
    });
    await this.queue.waitForIdle();
    return { status: 'replayed' };
  }
}
