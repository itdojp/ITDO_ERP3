'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DEFAULT_TELEMETRY_FILTERS, type TelemetryFilters } from '@/features/telemetry/types';
import { useTelemetryFilters } from '@/features/telemetry/useTelemetryFilters';

export type TelemetryFiltersContextValue = {
  filters: TelemetryFilters;
  formFilters: TelemetryFilters;
  setFormFilters: (updater: TelemetryFilters | ((prev: TelemetryFilters) => TelemetryFilters)) => void;
  applyFilters: (next: TelemetryFilters) => void;
  resetFilters: () => void;
  readFromStorage: () => TelemetryFilters | null;
  persistFilters: (filters: TelemetryFilters) => void;
  getFiltersSnapshot: () => TelemetryFilters;
  initialFilters: TelemetryFilters;
};

const TelemetryFiltersContext = createContext<TelemetryFiltersContextValue | undefined>(undefined);

const buildInitialSnapshot = (initial?: TelemetryFilters): TelemetryFilters => ({
  ...DEFAULT_TELEMETRY_FILTERS,
  ...(initial ?? {}),
});

export function TelemetryFiltersProvider({ initialFilters, children }: { initialFilters?: TelemetryFilters; children: ReactNode }) {
  const initialSnapshot = useMemo(() => buildInitialSnapshot(initialFilters), [initialFilters]);

  const { formFilters, setFormFilters, persistFilters, readFromStorage } = useTelemetryFilters(initialSnapshot);
  const [filters, setFiltersState] = useState<TelemetryFilters>(initialSnapshot);
  const filtersRef = useRef<TelemetryFilters>(initialSnapshot);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    const stored = readFromStorage();
    const merged = stored
      ? buildInitialSnapshot({ ...stored, ...initialSnapshot })
      : initialSnapshot;
    filtersRef.current = merged;
    setFiltersState(merged);
    setFormFilters(merged);
    persistFilters(merged);
  }, [initialSnapshot, persistFilters, readFromStorage, setFormFilters]);

  const applyFilters = useCallback(
    (next: TelemetryFilters) => {
      const merged = buildInitialSnapshot(next);
      filtersRef.current = merged;
      setFiltersState(merged);
      setFormFilters(merged);
      persistFilters(merged);
    },
    [persistFilters, setFormFilters],
  );

  const resetFilters = useCallback(() => {
    applyFilters(DEFAULT_TELEMETRY_FILTERS);
  }, [applyFilters]);

  const setFormFiltersProxy = useCallback(
    (updater: TelemetryFilters | ((prev: TelemetryFilters) => TelemetryFilters)) => {
      setFormFilters((prev) => {
        const nextValue = typeof updater === 'function' ? (updater as (prev: TelemetryFilters) => TelemetryFilters)(prev) : updater;
        return buildInitialSnapshot(nextValue);
      });
    },
    [setFormFilters],
  );

  const contextValue = useMemo<TelemetryFiltersContextValue>(
    () => ({
      filters,
      formFilters,
      setFormFilters: setFormFiltersProxy,
      applyFilters,
      resetFilters,
      readFromStorage,
      persistFilters,
      getFiltersSnapshot: () => filtersRef.current,
      initialFilters: initialSnapshot,
    }),
    [filters, formFilters, setFormFiltersProxy, applyFilters, resetFilters, readFromStorage, persistFilters, initialSnapshot],
  );

  return <TelemetryFiltersContext.Provider value={contextValue}>{children}</TelemetryFiltersContext.Provider>;
}

export function useTelemetryFiltersContext(): TelemetryFiltersContextValue {
  const context = useContext(TelemetryFiltersContext);
  if (!context) {
    throw new Error('useTelemetryFiltersContext must be used within a TelemetryFiltersProvider');
  }
  return context;
}
