import { TelemetryClient } from '@/features/telemetry/TelemetryClient';
import type { TelemetryResponse, TelemetryFilters } from '@/features/telemetry/types';
import { TelemetryFiltersProvider } from '@/contexts/telemetry/TelemetryFiltersContext';
import { reportServerTelemetry } from '@/lib/telemetry';

const DEFAULT_POLL_MS = 15_000;

async function fetchTelemetry(): Promise<TelemetryResponse> {
  const base = process.env.POC_API_BASE ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${base}/api/v1/telemetry/ui`, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`status ${res.status}`);
    }
    return (await res.json()) as TelemetryResponse;
  } catch (error) {
    await reportServerTelemetry({
      component: 'telemetry/page',
      event: 'fetch_failed',
      level: 'warn',
      detail: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return { items: [], total: 0 };
  }
}

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function resolvePollInterval(searchParams?: Record<string, string | string[] | undefined>) {
  const envCandidate = process.env.NEXT_PUBLIC_TELEMETRY_POLL_MS ?? process.env.TELEMETRY_POLL_MS;
  const paramCandidate = searchParams?.pollMs;
  const candidate = Array.isArray(paramCandidate) ? paramCandidate[0] : paramCandidate ?? envCandidate;
  const parsed = Number(candidate);
  if (Number.isFinite(parsed) && parsed >= 250) {
    return parsed;
  }
  return DEFAULT_POLL_MS;
}

const normalizeString = (value: string | string[] | undefined) => {
  if (!value) return '';
  return Array.isArray(value) ? value[0] ?? '' : value;
};

const normalizeLevel = (value: string): 'all' | 'info' | 'warn' | 'error' => {
  const normalized = value.toLowerCase();
  return ['info', 'warn', 'error'].includes(normalized) ? (normalized as 'info' | 'warn' | 'error') : 'all';
};

const normalizeOrigin = (value: string): 'all' | 'client' | 'server' => {
  const normalized = value.toLowerCase();
  return ['client', 'server'].includes(normalized) ? (normalized as 'client' | 'server') : 'all';
};

const normalizeSort = (value: string): 'receivedAt' | 'timestamp' | 'component' | 'event' | 'level' | 'origin' => {
  const allowed = new Set(['receivedAt', 'timestamp', 'component', 'event', 'level', 'origin']);
  return allowed.has(value) ? (value as any) : 'receivedAt';
};

const normalizeOrder = (value: string): 'asc' | 'desc' => {
  const normalized = value.toLowerCase();
  return normalized === 'asc' ? 'asc' : 'desc';
};

export default async function TelemetryPage({ searchParams }: PageProps) {
  const data = await fetchTelemetry();
  const pollIntervalMs = resolvePollInterval(searchParams);
  const initialFilters: TelemetryFilters = {
    component: normalizeString(searchParams?.component),
    event: normalizeString(searchParams?.event),
    detail: normalizeString(searchParams?.detail),
    detailPath: normalizeString(searchParams?.detail_path),
    level: normalizeLevel(normalizeString(searchParams?.level)),
    origin: normalizeOrigin(normalizeString(searchParams?.origin)),
    sort: normalizeSort(normalizeString(searchParams?.sort) || 'receivedAt'),
    order: normalizeOrder(normalizeString(searchParams?.order) || 'desc'),
  } as const;

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">Telemetry Monitor</h2>
        <p className="text-sm text-slate-400">
          `/api/v1/telemetry/ui` に投稿された最新イベントを表示します。Podman スタックを起動している場合は
          Loki にも転送され、Grafana の <strong>PoC UI Telemetry</strong> ダッシュボードで確認できます。
        </p>
      </header>
      <TelemetryFiltersProvider initialFilters={initialFilters}>
        <TelemetryClient initialData={data} pollIntervalMs={pollIntervalMs} />
      </TelemetryFiltersProvider>
    </section>
  );
}
