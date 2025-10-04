export type TelemetryItem = {
  component?: string;
  event?: string;
  level?: string;
  detail?: Record<string, unknown>;
  timestamp?: string;
  receivedAt?: string;
  origin?: string;
};

export type TelemetryResponse = {
  items?: TelemetryItem[];
  total?: number;
};

export type TelemetryFilters = {
  component: string;
  event: string;
  detail: string;
  detailPath: string;
  level: 'all' | 'info' | 'warn' | 'error';
  origin: 'all' | 'client' | 'server';
  sort: 'receivedAt' | 'timestamp' | 'component' | 'event' | 'level' | 'origin';
  order: 'asc' | 'desc';
};

export const DEFAULT_TELEMETRY_FILTERS: TelemetryFilters = {
  component: '',
  event: '',
  detail: '',
  detailPath: '',
  level: 'all',
  origin: 'all',
  sort: 'receivedAt',
  order: 'desc',
};
