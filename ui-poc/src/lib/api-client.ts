'use client';

const defaultBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001';
const enableLogging = (process.env.NEXT_PUBLIC_ENABLE_API_LOGGING ?? 'false').toLowerCase() === 'true';

export type ApiRequestOptions = RequestInit & {
  path: string;
  baseUrl?: string;
};

export async function apiRequest<T>(options: ApiRequestOptions): Promise<T> {
  const { path, baseUrl = defaultBase, headers, ...rest } = options;
  const url = new URL(path, baseUrl).toString();
  const requestHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  } satisfies HeadersInit;

  if (enableLogging) {
    console.debug('[api] request', { url, rest });
  }

  const res = await fetch(url, {
    ...rest,
    headers: requestHeaders,
    cache: 'no-store',
  });

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch (err) {
      body = await res.text();
    }
    if (enableLogging) {
      console.warn('[api] error', { url, status: res.status, body });
    }
    throw new Error(`API request failed (${res.status}): ${JSON.stringify(body)}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}
