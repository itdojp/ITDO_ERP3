'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TelemetryFilters } from './types';

const STORAGE_KEY = 'ui-poc:telemetry-filters';

const normalizeFilters = (base: TelemetryFilters, overrides?: Partial<TelemetryFilters>): TelemetryFilters => ({
  component: overrides?.component ?? base.component ?? '',
  event: overrides?.event ?? base.event ?? '',
  detail: overrides?.detail ?? base.detail ?? '',
  detailPath: overrides?.detailPath ?? base.detailPath ?? '',
  level: overrides?.level ?? base.level ?? 'all',
  origin: overrides?.origin ?? base.origin ?? 'all',
  sort: overrides?.sort ?? base.sort ?? 'receivedAt',
  order: overrides?.order ?? base.order ?? 'desc',
});

function readFromStorage(): TelemetryFilters | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const level = ['info', 'warn', 'error'].includes(parsed.level) ? parsed.level : 'all';
    const origin = ['client', 'server'].includes(parsed.origin) ? parsed.origin : 'all';
    const sort = ['receivedAt', 'timestamp', 'component', 'event', 'level', 'origin'].includes(parsed.sort)
      ? parsed.sort
      : 'receivedAt';
    const order = ['asc', 'desc'].includes(parsed.order) ? parsed.order : 'desc';
    return {
      component: typeof parsed.component === 'string' ? parsed.component : '',
      event: typeof parsed.event === 'string' ? parsed.event : '',
      detail: typeof parsed.detail === 'string' ? parsed.detail : '',
      detailPath: typeof parsed.detailPath === 'string' ? parsed.detailPath : '',
      level,
      origin,
      sort,
      order,
    } as TelemetryFilters;
  } catch (error) {
    console.warn('[telemetry] failed to read filters from storage', error);
    return null;
  }
}

export function useTelemetryFilters(initial: TelemetryFilters) {
  const [formFilters, setFormFilters] = useState<TelemetryFilters>(() => normalizeFilters(initial));

  useEffect(() => {
    const stored = readFromStorage();
    const merged = stored ? normalizeFilters(initial, stored) : normalizeFilters(initial);
    setFormFilters(merged);
  }, [initial]);

  const persistFilters = useCallback(
    (filters: TelemetryFilters) => {
      const normalized = normalizeFilters(initial, filters);
      setFormFilters(normalized);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {
      console.warn('[telemetry] failed to persist filters', error);
    }
    },
    [initial],
  );

  const loadStoredFilters = useCallback(() => readFromStorage(), []);

  return {
    formFilters,
    setFormFilters,
    persistFilters,
    readFromStorage: loadStoredFilters,
  };
}
