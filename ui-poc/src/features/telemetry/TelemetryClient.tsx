'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { resolveApiBase, reportClientTelemetry } from '@/lib/telemetry';
import { collectRelatedLinks } from './link-utilities';
import { useTelemetryFiltersContext } from '@/contexts/telemetry/TelemetryFiltersContext';
import type { TelemetryItem, TelemetryResponse, TelemetryFilters } from './types';
import { DEFAULT_TELEMETRY_FILTERS } from './types';

const MAX_ROWS = 100;
const PROJECTS_PAGE_PATH = '/projects';

function formatTimestamp(value?: string) {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleString('ja-JP')} (${value})`;
}

type TelemetryClientProps = {
  initialData: TelemetryResponse;
  pollIntervalMs: number;
};

export function TelemetryClient({ initialData, pollIntervalMs }: TelemetryClientProps) {
  const [items, setItems] = useState<readonly TelemetryItem[]>(() => initialData.items ?? []);
  const [total, setTotal] = useState<number>(initialData.total ?? initialData.items?.length ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(() => Math.floor(pollIntervalMs / 1000));
  const { filters, formFilters, setFormFilters, applyFilters: applyFiltersContext, getFiltersSnapshot } =
    useTelemetryFiltersContext();

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const baseUrl = useMemo(() => resolveApiBase(), []);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const baseSearchParams = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);
  const linkButtonClass =
    'inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 transition-colors hover:border-sky-400 hover:text-sky-100';

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set('limit', String(MAX_ROWS));
    const current = getFiltersSnapshot();
    if (current.component.trim().length > 0) params.set('component', current.component.trim());
    if (current.event.trim().length > 0) params.set('event', current.event.trim());
    if (current.detail.trim().length > 0) params.set('detail', current.detail.trim());
    if (current.detailPath.trim().length > 0) params.set('detail_path', current.detailPath.trim());
    if (current.level !== 'all') params.set('level', current.level);
    if (current.origin !== 'all') params.set('origin', current.origin);
    if (current.sort) params.set('sort', current.sort);
    if (current.order) params.set('order', current.order);
    return params;
  }, [getFiltersSnapshot]);

  const loadTelemetry = useCallback(
    async ({ silent = false, refresh = false }: { silent?: boolean; refresh?: boolean } = {}) => {
      if (!silent) setIsLoading(true);
      setError(null);
      try {
        const urlObject = new URL('/api/v1/telemetry/ui', baseUrl);
        urlObject.search = buildQuery().toString();
        const response = await fetch(urlObject.toString(), { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`status ${response.status}`);
        }
        const payload = (await response.json()) as TelemetryResponse;
        setItems(Array.isArray(payload.items) ? payload.items : []);
        setTotal(typeof payload.total === 'number' ? payload.total : payload.items?.length ?? 0);
        setLastUpdated(new Date());
        setSecondsUntilRefresh(Math.floor(pollIntervalMs / 1000));
        if (refresh) {
          console.info('[telemetry] manual refresh triggered', { filters: getFiltersSnapshot() });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(`最新のTelemetry取得に失敗しました (${message})`);
        setSecondsUntilRefresh(Math.floor(pollIntervalMs / 1000));
        void reportClientTelemetry({
          component: 'telemetry/client',
          event: 'poll_failed',
          level: 'warn',
          detail: {
            message,
            filters: getFiltersSnapshot(),
          },
        });
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [baseUrl, buildQuery, getFiltersSnapshot, pollIntervalMs],
  );

  const handleManualRefresh = useCallback(() => {
    void loadTelemetry({ refresh: true });
  }, [loadTelemetry]);

  useEffect(() => {
    void loadTelemetry({ silent: true });
    intervalRef.current = setInterval(() => {
      void loadTelemetry({ silent: true });
    }, pollIntervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadTelemetry, pollIntervalMs]);

  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setSecondsUntilRefresh((prev) => (prev <= 1 ? Math.floor(pollIntervalMs / 1000) : prev - 1));
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [pollIntervalMs]);

  useEffect(() => {
    void loadTelemetry();
  }, [filters, loadTelemetry]);

  const renderedItems = useMemo(() => items.slice(0, MAX_ROWS), [items]);
  const highlightKey = useMemo(() => filters.detail.trim().toLowerCase(), [filters.detail]);
  const serializedDetails = useMemo(
    () => renderedItems.map((item) => (item?.detail ? JSON.stringify(item.detail).toLowerCase() : '')),
    [renderedItems],
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedItem = useMemo(() => (selectedIndex !== null ? renderedItems[selectedIndex] ?? null : null), [renderedItems, selectedIndex]);
  const slackWorkspaceBaseUrl = process.env.NEXT_PUBLIC_SLACK_WORKSPACE_URL ?? null;
  const { projectLinks, slackLinks } = useMemo(() => {
    return collectRelatedLinks(selectedItem?.detail ?? null, {
      projectsPagePath: PROJECTS_PAGE_PATH,
      slackWorkspaceBaseUrl,
    });
  }, [selectedItem, slackWorkspaceBaseUrl]);

  const highlightMatches = useMemo(() => {
    if (!highlightKey) return new Set<number>();
    const matches = new Set<number>();
    serializedDetails.forEach((serialized, index) => {
      if (serialized.includes(highlightKey)) {
        matches.add(index);
      }
    });
    return matches;
  }, [serializedDetails, highlightKey]);
  const firstHighlightIndex = useMemo(() => {
    if (highlightMatches.size === 0) return undefined;
    return Math.min(...Array.from(highlightMatches.values()));
  }, [highlightMatches]);
  const highlightRowRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    highlightRowRef.current = null;
  }, [firstHighlightIndex]);

  useEffect(() => {
    if (firstHighlightIndex === undefined) {
      return;
    }
    if (highlightRowRef.current) {
      highlightRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [firstHighlightIndex, renderedItems]);

  useEffect(() => {
    if (firstHighlightIndex !== undefined) {
      setSelectedIndex(firstHighlightIndex);
    } else if (selectedIndex === null && renderedItems.length > 0) {
      setSelectedIndex(0);
    } else if (selectedIndex !== null && selectedIndex >= renderedItems.length) {
      setSelectedIndex(renderedItems.length - 1);
    }
  }, [firstHighlightIndex, renderedItems, selectedIndex]);

  const syncQuery = useCallback(
    (nextFilters: TelemetryFilters) => {
      const params = new URLSearchParams(baseSearchParams.toString());
      const assign = (key: string, value: string) => {
        if (value.trim().length > 0) params.set(key, value.trim());
        else params.delete(key);
      };
      assign('component', nextFilters.component);
      assign('event', nextFilters.event);
      assign('detail', nextFilters.detail);
      assign('detail_path', nextFilters.detailPath);
      if (nextFilters.level === 'all') params.delete('level');
      else params.set('level', nextFilters.level);
      if (nextFilters.origin === 'all') params.delete('origin');
      else params.set('origin', nextFilters.origin);
      params.set('sort', nextFilters.sort);
      params.set('order', nextFilters.order);
      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [baseSearchParams, pathname, router],
  );

  const handleFilterChange = (field: keyof TelemetryFilters) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setFormFilters((prev) => ({ ...prev, [field]: value }));
    };

  const applyFilters = useCallback(
    (next: TelemetryFilters) => {
      const sanitized = { ...DEFAULT_TELEMETRY_FILTERS, ...next } as TelemetryFilters;
      applyFiltersContext(sanitized);
      syncQuery(sanitized);
    },
    [applyFiltersContext, syncQuery],
  );

  const handleResetFilters = () => {
    applyFilters(DEFAULT_TELEMETRY_FILTERS);
  };

  return (
    <div className="space-y-6">
      <form
        className="grid gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-200 md:grid-cols-5"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          applyFilters(formFilters);
        }}
      >
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">Component</span>
          <input
            value={formFilters.component}
            onChange={handleFilterChange('component')}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
            placeholder="例: compliance/client"
            data-testid="telemetry-filter-component"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">Event</span>
          <input
            value={formFilters.event}
            onChange={handleFilterChange('event')}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
            placeholder="例: mock_fallback"
            data-testid="telemetry-filter-event"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">Detail</span>
          <input
            value={formFilters.detail}
            onChange={handleFilterChange('detail')}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
            placeholder="例: marker"
            data-testid="telemetry-filter-detail"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">Detail Path (JSONPath)</span>
          <input
            value={formFilters.detailPath}
            onChange={handleFilterChange('detailPath')}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
            placeholder="例: $.detail.marker または items[0].code"
            data-testid="telemetry-filter-detail-path"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">Level</span>
          <select
            value={formFilters.level}
            onChange={handleFilterChange('level')}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
            data-testid="telemetry-filter-level"
          >
            <option value="all">All</option>
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="error">error</option>
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">Origin</span>
          <select
            value={formFilters.origin}
            onChange={handleFilterChange('origin')}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
            data-testid="telemetry-filter-origin"
          >
            <option value="all">All</option>
            <option value="client">client</option>
            <option value="server">server</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded-md border border-sky-500 bg-sky-500/20 px-3 py-2 text-xs font-semibold text-sky-100 transition-colors hover:border-sky-400 hover:bg-sky-500/30"
            data-testid="telemetry-filter-apply"
          >
            フィルタ適用
          </button>
          <button
            type="button"
            onClick={handleResetFilters}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
            data-testid="telemetry-filter-reset"
          >
            リセット
          </button>
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">Sort</span>
          <select
            value={formFilters.sort}
            onChange={handleFilterChange('sort')}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
            data-testid="telemetry-filter-sort"
          >
            <option value="receivedAt">Timestamp (cached)</option>
            <option value="timestamp">Raw Timestamp</option>
            <option value="component">Component</option>
            <option value="event">Event</option>
            <option value="level">Level</option>
            <option value="origin">Origin</option>
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">Order</span>
          <select
            value={formFilters.order}
            onChange={handleFilterChange('order')}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
            data-testid="telemetry-filter-order"
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </label>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-200">
        <div className="space-y-1">
          <p>
            取得件数: <strong data-testid="telemetry-total">{total}</strong>
          </p>
          <p className="text-xs text-slate-500">
            表示上限: {MAX_ROWS}件。自動更新まで残り <strong>{secondsUntilRefresh}s</strong>
          </p>
          {lastUpdated ? (
            <p className="text-xs text-slate-500">最終更新: {lastUpdated.toLocaleString('ja-JP')}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {error ? <span className="text-xs text-amber-400">{error}</span> : null}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isLoading}
            className="rounded-md border border-sky-500 bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-100 transition-colors hover:border-sky-400 hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:text-slate-500"
            data-testid="telemetry-refresh"
          >
            {isLoading ? '更新中...' : '手動更新'}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60" data-testid="telemetry-table">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-300">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Timestamp</th>
              <th className="px-4 py-3 text-left font-semibold">Component</th>
              <th className="px-4 py-3 text-left font-semibold">Event</th>
              <th className="px-4 py-3 text-left font-semibold">Level</th>
              <th className="px-4 py-3 text-left font-semibold">Origin</th>
              <th className="px-4 py-3 text-left font-semibold">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {renderedItems.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-center text-slate-500" colSpan={6}>
                  Telemetry イベントはまだありません。
                </td>
              </tr>
            ) : (
              renderedItems.map((item, index) => {
                const isHighlighted = highlightMatches.has(index);
                const isSelected = selectedIndex === index;
                return (
                  <tr
                    key={`${item.timestamp || item.receivedAt || index}-${index}`}
                    ref={index === firstHighlightIndex ? highlightRowRef : undefined}
                    className={`hover:bg-slate-800/40 ${
                      isSelected ? 'bg-sky-600/20 ring-1 ring-sky-500/80' : isHighlighted ? 'bg-sky-500/10 ring-1 ring-sky-500/60' : ''
                    }`}
                    onClick={() => setSelectedIndex(index)}
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col">
                        <span>{formatTimestamp(item.receivedAt || item.timestamp)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-200">{item.component ?? 'n/a'}</td>
                    <td className="px-4 py-3 align-top text-slate-200">{item.event ?? 'n/a'}</td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${
                          item.level === 'error'
                            ? 'bg-rose-500/20 text-rose-200'
                            : item.level === 'warn'
                              ? 'bg-amber-500/20 text-amber-200'
                              : 'bg-emerald-500/20 text-emerald-200'
                        }`}
                      >
                        {item.level ?? 'info'}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-300">{item.origin ?? 'n/a'}</td>
                    <td className="px-4 py-3 align-top text-xs text-slate-300">
                      <pre className="whitespace-pre-wrap break-words text-xs">
                        {item.detail ? JSON.stringify(item.detail, null, 2) : '—'}
                      </pre>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedItem ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">選択したイベント</p>
              <p className="text-slate-400">{formatTimestamp(selectedItem.receivedAt || selectedItem.timestamp)}</p>
            </div>
            <button
              type="button"
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
              onClick={() => setSelectedIndex(null)}
            >
              クリア
            </button>
          </div>
          <dl className="mt-3 grid gap-2 text-slate-300 md:grid-cols-2">
            <div><dt className="text-slate-500">Component</dt><dd>{selectedItem.component ?? 'n/a'}</dd></div>
            <div><dt className="text-slate-500">Event</dt><dd>{selectedItem.event ?? 'n/a'}</dd></div>
            <div><dt className="text-slate-500">Level</dt><dd>{selectedItem.level ?? 'info'}</dd></div>
            <div><dt className="text-slate-500">Origin</dt><dd>{selectedItem.origin ?? 'n/a'}</dd></div>
          </dl>
          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              {projectLinks.length > 0 || slackLinks.length > 0 ? (
              <div className="mb-3 space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-400">関連リンク</p>
                <div className="flex flex-wrap gap-2">
                  {projectLinks.map((link) => (
                    <a key={`project-link-${link.href}`} href={link.href} className={linkButtonClass}>
                      {link.label}
                    </a>
                  ))}
                  {slackLinks.map((href) => {
                    const slackLabel = (() => {
                      try {
                        if (href.startsWith('http')) {
                          const url = new URL(href);
                          const channel = url.searchParams.get('channel');
                          if (channel) return `Slack #${channel}`;
                          const segments = url.pathname.split('/').filter(Boolean);
                          if (segments.length > 0) {
                            return `Slack ${segments[segments.length - 1]}`;
                          }
                        }
                      } catch (error) {
                        console.warn(
                          '[telemetry] failed to parse Slack URL. Expected format: https://slack.com/app_redirect?channel=CHANNEL や https://slack.com/archives/CHANNEL_ID',
                          'received:', href,
                          'error:', error,
                        );
                      }
                      return 'Slack';
                    })();
                    return (
                      <a
                        key={`slack-link-${href}`}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkButtonClass}
                      >
                        {slackLabel}
                        <span aria-hidden="true">↗</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-[11px]">
              {selectedItem.detail ? JSON.stringify(selectedItem.detail, null, 2) : '詳細情報はありません'}
            </pre>
          </div>
        </div>
      ) : null}

    </div>
  );
}
