export type TelemetryEvent = {
  component: string;
  event: string;
  level?: 'info' | 'warn' | 'error';
  detail?: Record<string, unknown>;
};

type TelemetryPayload = TelemetryEvent & {
  timestamp: string;
  origin: 'client' | 'server';
  environment: string;
};

export function resolveApiBase() {
  if (typeof process !== 'undefined') {
    if (process.env.POC_API_BASE && process.env.POC_API_BASE.trim().length > 0) {
      return process.env.POC_API_BASE;
    }
    if (process.env.NEXT_PUBLIC_API_BASE && process.env.NEXT_PUBLIC_API_BASE.trim().length > 0) {
      return process.env.NEXT_PUBLIC_API_BASE;
    }
  }
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  return 'http://localhost:3001';
}

function buildPayload(event: TelemetryEvent, origin: 'client' | 'server'): TelemetryPayload {
  const environment = process.env.NEXT_PUBLIC_STAGE || process.env.NODE_ENV || 'development';
  const detail = event.detail ? sanitizeDetail(event.detail) : undefined;
  return {
    ...event,
    detail,
    timestamp: new Date().toISOString(),
    origin,
    environment,
  };
}

function sanitizeDetail(detail: Record<string, unknown>): Record<string, unknown> {
  const entries = Object.entries(detail).map(([key, value]) => {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
      return [key, value];
    }
    if (value instanceof Error) {
      return [key, value.message];
    }
    try {
      return [key, JSON.parse(JSON.stringify(value))];
    } catch (error) {
      return [key, String(value)];
    }
  });
  return Object.fromEntries(entries);
}

const telemetryPath = '/api/v1/telemetry/ui';

async function postTelemetry(payload: TelemetryPayload, init?: RequestInit) {
  const base = resolveApiBase();
  let url: string;
  try {
    url = new URL(telemetryPath, base).toString();
  } catch (error) {
    url = `${base.replace(/\/$/, '')}${telemetryPath}`;
  }

  if (typeof fetch === 'function') {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        cache: 'no-store',
        ...init,
      });
      return true;
    } catch (error) {
      console.warn('[telemetry] failed to POST telemetry', error);
      return false;
    }
  }
  return false;
}

export function reportClientTelemetry(event: TelemetryEvent) {
  if (typeof window === 'undefined') {
    return;
  }
  const payload = buildPayload(event, 'client');
  console.info('[telemetry:ui]', JSON.stringify(payload));

  if (navigator && typeof navigator.sendBeacon === 'function') {
    try {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const base = resolveApiBase();
      let url: string;
      try {
        url = new URL(telemetryPath, base).toString();
      } catch (error) {
        url = `${base.replace(/\/$/, '')}${telemetryPath}`;
      }
      const sent = navigator.sendBeacon(url, blob);
      if (sent) {
        return;
      }
    } catch (error) {
      console.warn('[telemetry] sendBeacon failed', error);
    }
  }

  void postTelemetry(payload, { keepalive: true });
}

export async function reportServerTelemetry(event: TelemetryEvent) {
  const payload = buildPayload(event, 'server');
  console.info('[telemetry:ui]', JSON.stringify(payload));
  await postTelemetry(payload);
}
