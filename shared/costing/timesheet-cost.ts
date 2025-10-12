export interface TimesheetEntry {
  id: string;
  contractId: string;
  hours: number;
  rate: number;
  approved: boolean;
}

export interface CostAccumulator {
  contractId: string;
  amount: number;
  timesheetIds: string[];
}

export function aggregateCosts(entries: TimesheetEntry[]): CostAccumulator[] {
  const approved = entries.filter((entry) => entry.approved);
  const map = new Map<string, CostAccumulator>();
  for (const entry of approved) {
    const amount = +(entry.hours * entry.rate).toFixed(2);
    const current = map.get(entry.contractId) ?? {
      contractId: entry.contractId,
      amount: 0,
      timesheetIds: [],
    };
    current.amount = +(current.amount + amount).toFixed(2);
    current.timesheetIds.push(entry.id);
    map.set(entry.contractId, current);
  }
  return Array.from(map.values());
}
