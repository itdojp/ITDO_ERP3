export type ContractStatus = 'draft' | 'pendingSignature' | 'active' | 'expired' | 'terminated';

export interface ContractRecord {
  id: string;
  status: ContractStatus;
  issuedAt?: string;
  signedAt?: string;
  activatedAt?: string;
  terminatedAt?: string;
}

export interface ContractEventPayload {
  type: 'ISSUED' | 'SIGNED' | 'ACTIVATED' | 'RENEWED' | 'TERMINATED';
  occurredAt: string;
  triggeredBy: string;
  metadata?: Record<string, unknown>;
}

export class ContractLifecycleService {
  constructor(private readonly persist: (record: ContractRecord) => Promise<void>) {}

  async issue(contract: ContractRecord, triggeredBy: string) {
    if (contract.status !== 'draft') {
      throw new Error('Contract must be draft to issue');
    }
    contract.status = 'pendingSignature';
    contract.issuedAt = new Date().toISOString();
    await this.persist(contract);
    return this.event('ISSUED', triggeredBy);
  }

  async sign(contract: ContractRecord, triggeredBy: string) {
    if (contract.status !== 'pendingSignature') {
      throw new Error('Contract must be pending signature');
    }
    contract.status = 'active';
    contract.signedAt = new Date().toISOString();
    contract.activatedAt = contract.signedAt;
    await this.persist(contract);
    return this.event('SIGNED', triggeredBy);
  }

  async terminate(contract: ContractRecord, triggeredBy: string, reason?: string) {
    if (contract.status === 'terminated') {
      throw new Error('Contract already terminated');
    }
    contract.status = 'terminated';
    contract.terminatedAt = new Date().toISOString();
    await this.persist(contract);
    return this.event('TERMINATED', triggeredBy, { reason });
  }

  private event(type: ContractEventPayload['type'], triggeredBy: string, metadata?: Record<string, unknown>): ContractEventPayload {
    return {
      type,
      occurredAt: new Date().toISOString(),
      triggeredBy,
      metadata,
    };
  }
}
