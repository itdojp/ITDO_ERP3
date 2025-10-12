import { describe, it, expect } from 'vitest';
import { aggregateCosts } from '../../../shared/costing/timesheet-cost';

describe('aggregateCosts', () => {
  it('sums approved timesheets per contract', () => {
    const result = aggregateCosts([
      { id: 't1', contractId: 'c1', hours: 5, rate: 100, approved: true },
      { id: 't2', contractId: 'c1', hours: 3, rate: 120, approved: true },
      { id: 't3', contractId: 'c2', hours: 8, rate: 90, approved: false },
    ]);
    expect(result).toEqual([
      { contractId: 'c1', amount: 860, timesheetIds: ['t1', 't2'] },
    ]);
  });
});
