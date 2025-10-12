import { describe, it, expect, vi } from 'vitest';
import { ContractLifecycleService } from '../../../shared/contracts/lifecycle';
import { aggregateCosts } from '../../../shared/costing/timesheet-cost';

describe('contracts -> billing integration', () => {
  it('approves lifecycle and aggregates cost', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const lifecycle = new ContractLifecycleService(persist);
    const contract = { id: 'contract-1', status: 'draft' as const };

    const issued = await lifecycle.issue({ ...contract }, 'user-contract');
    expect(issued.type).toBe('ISSUED');

    const signed = await lifecycle.sign({ id: 'contract-1', status: 'pendingSignature' }, 'user-contract');
    expect(signed.type).toBe('SIGNED');

    const costs = aggregateCosts([
      { id: 'ts-1', contractId: 'contract-1', hours: 5, rate: 120, approved: true },
      { id: 'ts-2', contractId: 'contract-1', hours: 3, rate: 110, approved: true },
    ]);

    expect(costs[0]).toEqual({ contractId: 'contract-1', amount: 930, timesheetIds: ['ts-1', 'ts-2'] });
  });
});
