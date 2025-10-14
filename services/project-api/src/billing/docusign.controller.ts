import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ContractAutomationService } from './contract-automation.service';

interface DocuSignEnvelopeInformation {
  envelopeId: string;
  status: string;
  emailSubject?: string;
  contractCode?: string;
  customFields?: { textCustomFields?: { name: string; value: string }[] };
  recipients?: { signers?: { email?: string }[] };
}

@Controller('billing/docusign')
export class DocuSignWebhookController {
  constructor(private readonly automation: ContractAutomationService) {}

  @Post('webhook')
  @HttpCode(202)
  async handleWebhook(
    @Body('envelopeInformation') envelope: DocuSignEnvelopeInformation,
    @Headers('x-docusign-signature-01') signature: string,
  ) {
    // In production we would verify the signature. PoC logs and proceeds.
    const contractCode =
      envelope.contractCode ?? envelope.customFields?.textCustomFields?.find((field) => field.name === 'contractCode')?.value;

    await this.automation.handleContractEvent({
      type: envelope.status === 'completed' ? 'SIGNED' : 'ISSUED',
      occurredAt: new Date().toISOString(),
      triggeredBy: envelope.recipients?.signers?.[0]?.email ?? 'docusign',
      metadata: { envelopeId: envelope.envelopeId, signature },
      contractId: envelope.envelopeId,
      contractCode,
      customerEmail: envelope.recipients?.signers?.[0]?.email,
    });
    return { status: 'accepted' };
  }
}
