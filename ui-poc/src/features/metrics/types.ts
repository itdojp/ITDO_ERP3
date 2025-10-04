export type MetricsSummaryResponse = {
  projects: Record<string, number>;
  timesheets: Record<string, number>;
  invoices: Record<string, number>;
  events: number;
  cachedAt: string;
  cacheTtlMs: number;
  stale: boolean;
  idempotency?: {
    projectKeys?: number;
    timesheetKeys?: number;
  };
};
