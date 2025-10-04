'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type { MetricsSummaryResponse } from './types';

type LoadState = 'idle' | 'loading' | 'refreshing' | 'error';

type SnapshotEntry = {
  fetchedAt: number;
  data: MetricsSummaryResponse;
};

const STATUS_ORDER = ['planned', 'active', 'onhold', 'closed'];
const TIMESHEET_ORDER = ['draft', 'submitted', 'approved', 'rejected'];
const INVOICE_ORDER = ['registered', 'pending', 'matched', 'flagged', 'archived'];
const AUTO_REFRESH_MS = 15000;
const HISTORY_LIMIT = 10;

function formatTimestamp(value: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

async function fetchMetrics({ refresh = false } = {}): Promise<MetricsSummaryResponse> {
  const path = refresh ? '/metrics/summary?refresh=true' : '/metrics/summary';
  return apiRequest<MetricsSummaryResponse>({ path });
}

export function MetricsPanel() {
  const [metrics, setMetrics] = useState<MetricsSummaryResponse | null>(null);
  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SnapshotEntry[]>([]);
  const [timeToNext, setTimeToNext] = useState(AUTO_REFRESH_MS / 1000);

  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const loadRef = useRef<({ refresh }?: { refresh?: boolean }) => Promise<MetricsSummaryResponse | null>>();

  const scheduleAutoRefresh = useCallback(() => {
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    autoRefreshRef.current = setInterval(() => {
      void loadRef.current?.({ refresh: false });
    }, AUTO_REFRESH_MS);
  }, []);

  const handleSuccess = useCallback((data: MetricsSummaryResponse) => {
    setMetrics(data);
    setHistory((prev) => {
      const next = [...prev, { fetchedAt: Date.now(), data }];
      return next.slice(-HISTORY_LIMIT);
    });
    setState('idle');
    setTimeToNext(AUTO_REFRESH_MS / 1000);
    scheduleAutoRefresh();
  }, [scheduleAutoRefresh]);

  const load = useCallback(
    async ({ refresh = false }: { refresh?: boolean } = {}) => {
      setState((current) => {
        if (current === 'idle') return refresh ? 'refreshing' : 'loading';
        if (refresh) return 'refreshing';
        return current === 'error' ? 'loading' : current;
      });
      setError(null);
      try {
        const data = await fetchMetrics({ refresh });
        handleSuccess(data);
        return data;
      } catch (err) {
        console.error('[metrics] failed to load metrics', err);
        setError('メトリクスの取得に失敗しました');
        setState('error');
        setTimeToNext(AUTO_REFRESH_MS / 1000);
        scheduleAutoRefresh();
        return null;
      }
    },
    [handleSuccess, scheduleAutoRefresh],
  );

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    void load({ refresh: false });
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [load]);

  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setTimeToNext((prev) => (prev <= 1 ? AUTO_REFRESH_MS / 1000 : prev - 1));
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const projectEntries = useMemo(() => toEntries(metrics?.projects, STATUS_ORDER), [metrics]);
  const timesheetEntries = useMemo(() => toEntries(metrics?.timesheets, TIMESHEET_ORDER), [metrics]);
  const invoiceEntries = useMemo(() => toEntries(metrics?.invoices, INVOICE_ORDER), [metrics]);
  const maxEvents = useMemo(() => {
    const values = history.map((item) => item.data.events);
    if (metrics) values.push(metrics.events);
    return Math.max(...values, 1);
  }, [history, metrics]);

  const recentHistory = useMemo(() => history.slice(-5).reverse(), [history]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/40" data-testid="metrics-panel">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Podman Metrics Snapshot</h3>
          <p className="text-xs text-slate-400">
            `/metrics/summary` のレスポンスを表示しています。手動リフレッシュでキャッシュを無効化できます。
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>次回更新まで: {timeToNext}s</span>
          <button
            type="button"
            onClick={() => void load({ refresh: true })}
            className="rounded-md border border-sky-500 bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-100 transition-colors hover:border-sky-400 hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:text-slate-500"
            disabled={state === 'loading' || state === 'refreshing'}
            data-testid="metrics-refresh"
          >
            {state === 'refreshing' ? '再取得中...' : 'キャッシュ無効化'}
          </button>
          <button
            type="button"
            onClick={() => void load({ refresh: false })}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 transition-colors hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:text-slate-500"
            disabled={state === 'loading'}
          >
            最新取得
          </button>
        </div>
      </header>

      {state === 'loading' && !metrics ? (
        <p className="mt-4 text-sm text-slate-400">メトリクスを読み込み中...</p>
      ) : null}

      {error ? <p className="mt-4 text-sm text-amber-400">{error}</p> : null}

      {metrics ? (
        <div className="mt-6 space-y-6" data-testid="metrics-summary">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard title="Projects" entries={projectEntries} />
            <StatCard title="Timesheets" entries={timesheetEntries} />
            <StatCard title="Invoices" entries={invoiceEntries} />
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4" data-testid="metrics-events">
              <p className="text-xs uppercase tracking-wide text-slate-400">Events</p>
              <p className="mt-1 text-3xl font-semibold text-sky-100">{metrics.events}</p>
              <p className="mt-2 text-xs text-slate-500">
                snapshot: {formatTimestamp(new Date(metrics.cachedAt).getTime())}
                {metrics.stale ? (
                  <span className="ml-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">STALE</span>
                ) : null}
              </p>
              <p className="text-xs text-slate-500">cache TTL: {(metrics.cacheTtlMs / 1000).toFixed(0)}s</p>
            </div>
          </div>

          {recentHistory.length > 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4" data-testid="metrics-history">
              <h4 className="text-xs uppercase tracking-wide text-slate-400">Recent Snapshots</h4>
              <ul className="mt-3 space-y-2 text-xs text-slate-300">
                {recentHistory.map((entry) => (
                  <li key={entry.fetchedAt} className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <span className="text-slate-400">{formatTimestamp(entry.fetchedAt)}</span>
                    <div className="flex flex-1 items-center gap-2 md:justify-end">
                      <span className="text-slate-500">Events</span>
                      <span className="font-semibold text-slate-100">{entry.data.events}</span>
                      <div className="h-2 w-32 overflow-hidden rounded bg-slate-800">
                        <div
                          className="h-full rounded bg-sky-500"
                          style={{ width: `${Math.min(100, (entry.data.events / maxEvents) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

type StatCardProps = {
  title: string;
  entries: Array<{ label: string; value: number }>;
};

function StatCard({ title, entries }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4" data-testid={`metrics-${title.toLowerCase()}`}>
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <div className="mt-2 space-y-1 text-sm text-slate-200">
        {entries.length === 0 ? <p className="text-slate-500">データなし</p> : null}
        {entries.map((entry) => (
          <div key={entry.label} className="flex items-center justify-between gap-2">
            <span className="text-slate-400">{entry.label}</span>
            <span className="font-semibold text-slate-200">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function toEntries(record: Record<string, number> | undefined, order: string[]) {
  if (!record) return [] as Array<{ label: string; value: number }>;
  const entries = Object.entries(record);
  const orderMap = new Map(order.map((key, index) => [key, index]));
  return entries
    .sort((a, b) => {
      const indexA = orderMap.get(a[0]) ?? Number.MAX_SAFE_INTEGER;
      const indexB = orderMap.get(b[0]) ?? Number.MAX_SAFE_INTEGER;
      if (indexA === indexB) return a[0].localeCompare(b[0]);
      return indexA - indexB;
    })
    .map(([label, value]) => ({ label, value }));
}
