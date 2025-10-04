'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TelemetryFilters } from './types';

const STORAGE_KEY = 'ui-poc:telemetry-filters';

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
  const [formFilters, setFormFilters] = useState<TelemetryFilters>(initial);

  useEffect(() => {
    const stored = readFromStorage();
    if (stored) {
      setFormFilters(stored);
    } else {
      setFormFilters(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setFormFilters((current) => ({
      component: current.component ?? initial.component,
      event: current.event ?? initial.event,
      detail: current.detail ?? initial.detail,
      detailPath: current.detailPath ?? initial.detailPath,
      level: current.level ?? initial.level,
      origin: current.origin ?? initial.origin,
      sort: current.sort ?? initial.sort,
      order: current.order ?? initial.order,
    }));
  }, [initial.component, initial.event, initial.detail, initial.level, initial.origin, initial.sort, initial.order]);

  const persistFilters = useCallback((filters: TelemetryFilters) => {
    setFormFilters(filters);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch (error) {
      console.warn('[telemetry] failed to persist filters', error);
    }
  }, []);

  const loadStoredFilters = useCallback(() => readFromStorage(), []);

  return {
    formFilters,
    setFormFilters,
    persistFilters,
    readFromStorage: loadStoredFilters,
  };
}
