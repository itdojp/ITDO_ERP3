const defaultBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001';
const enableLogging = (process.env.NEXT_PUBLIC_ENABLE_API_LOGGING ?? 'false').toLowerCase() === 'true';

export type ApiRequestOptions = RequestInit & {
  path: string;
  baseUrl?: string;
};

type GraphQLResponse<TData> = {
  data?: TData;
  errors?: Array<{
    message: string;
    path?: (string | number)[];
    extensions?: Record<string, unknown>;
  }>;
};

export type GraphQLRequestOptions<TVars extends Record<string, unknown> | undefined = Record<string, unknown>> = {
  query: string;
  variables?: TVars;
  baseUrl?: string;
  headers?: HeadersInit;
  fallback?: () => Promise<unknown>;
  onSuccess?: (payload: unknown) => void;
};

export async function apiRequestInternal<T>(options: ApiRequestOptions): Promise<T> {
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

export async function graphqlRequestInternal<TData, TVars extends Record<string, unknown> | undefined = Record<string, unknown>>(
  options: GraphQLRequestOptions<TVars>,
): Promise<TData> {
  const { query, variables, baseUrl = defaultBase, headers, fallback, onSuccess } = options;
  const url = new URL('/graphql', baseUrl).toString();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });

  const payload = (await res.json()) as GraphQLResponse<TData>;

  if (enableLogging) {
    console.debug('[graphql] response', { url, payload, status: res.status });
  }

  if (payload.errors && payload.errors.length > 0) {
    const messages = payload.errors.map((err) => err.message).join('; ');
    if (fallback) {
      if (enableLogging) {
        console.warn('[graphql] error, invoking fallback', { messages });
      }
      return fallback() as Promise<TData>;
    }
    throw new Error(`GraphQL error: ${messages}`);
  }

  if (!res.ok) {
    if (fallback) {
      if (enableLogging) {
        console.warn('[graphql] non-200 response, invoking fallback', { status: res.status });
      }
      return fallback() as Promise<TData>;
    }
    throw new Error(`GraphQL request failed (${res.status})`);
  }

  if (!payload.data) {
    if (fallback) {
      if (enableLogging) {
        console.warn('[graphql] missing data, invoking fallback');
      }
      return fallback() as Promise<TData>;
    }
    throw new Error('GraphQL response missing data');
  }
  onSuccess?.(payload.data);
  return payload.data;
}
