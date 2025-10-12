import { describe, it, expect, vi } from 'vitest';
import { ContractLifecycleService, ContractRecord } from '../../../shared/contracts/lifecycle';

describe('ContractLifecycleService', () => {
  const base: ContractRecord = { id: 'c-1', status: 'draft' };

  it('issues contract and emits event', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const service = new ContractLifecycleService(persist);
    const event = await service.issue({ ...base }, 'user-1');
    expect(event.type).toBe('ISSUED');
    expect(persist).toHaveBeenCalled();
  });

  it('transitions to active on sign', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const service = new ContractLifecycleService(persist);
    const contract: ContractRecord = { id: 'c-2', status: 'pendingSignature' };
    const event = await service.sign(contract, 'user-2');
    expect(event.type).toBe('SIGNED');
    expect(contract.status).toBe('active');
  });
});
