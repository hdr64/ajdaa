const TOKEN_STORAGE_KEY = 'ajdaa_admin_token';

// Same-origin by default: the Vite dev server proxies /api during development and
// Caddy does the same in production, so no absolute URL is ever needed.
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

const DEFAULT_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 120_000;

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** Field-level messages from the server's zod validation middleware. */
  get fieldErrors(): Record<string, string[]> {
    const issues = (this.details as { issues?: Record<string, string[]> } | undefined)?.issues;
    if (!issues) return {};
    return Object.fromEntries(
      Object.entries(issues).map(([field, messages]) => [field, Array.isArray(messages) ? messages : [String(messages)]])
    );
  }
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    // Private browsing / disabled storage: degrade to an in-memory session.
    return null;
  }
}

let memoryToken: string | null = null;

export function getAuthToken(): string | null {
  return safeStorage()?.getItem(TOKEN_STORAGE_KEY) ?? memoryToken;
}

export function setAuthToken(token: string): void {
  memoryToken = token;
  try {
    safeStorage()?.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Session stays in memory only.
  }
}

export function clearAuthToken(): void {
  memoryToken = null;
  try {
    safeStorage()?.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Nothing to clean up.
  }
}

type UnauthorizedHandler = () => void;

const unauthorizedHandlers = new Set<UnauthorizedHandler>();

/** Lets the app shell react to an expired session from any service call. */
export function onUnauthorized(handler: UnauthorizedHandler): () => void {
  unauthorizedHandlers.add(handler);
  return () => unauthorizedHandlers.delete(handler);
}

function notifyUnauthorized(): void {
  unauthorizedHandlers.forEach((handler) => handler());
}

function buildUrl(path: string, query?: Record<string, string | number | boolean | undefined | null>): string {
  const url = `${BASE_URL}${path}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.append(key, String(value));
  }

  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

function extractMessage(payload: unknown, fallback: string): { message: string; details: unknown } {
  if (payload && typeof payload === 'object') {
    const record = payload as { error?: unknown; message?: unknown };
    const message = typeof record.error === 'string' ? record.error : typeof record.message === 'string' ? record.message : null;
    if (message) return { message, details: payload };
    return { message: fallback, details: payload };
  }
  if (typeof payload === 'string' && payload.trim()) {
    return { message: payload, details: undefined };
  }
  return { message: fallback, details: undefined };
}

async function toApiError(response: Response): Promise<ApiError> {
  let payload: unknown;
  try {
    const text = await response.text();
    payload = text ? JSON.parse(text) : undefined;
  } catch {
    payload = undefined;
  }

  const fallback =
    response.status === 401
      ? 'Your session has expired. Please sign in again.'
      : response.status === 403
        ? 'You do not have permission to perform this action.'
        : response.status === 404
          ? 'The requested resource was not found.'
          : `Request failed with status ${response.status}`;

  const { message, details } = extractMessage(payload, fallback);
  return new ApiError(response.status, message, details);
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** JSON request helper. Serialises `body`, injects the JWT, and normalises errors. */
async function request<T>(method: string, path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  // Compose the caller's signal with our own timeout so either can abort.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const externalSignal = options.signal;
  const abortFromExternal = () => controller.abort();
  externalSignal?.addEventListener('abort', abortFromExternal);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted && !externalSignal?.aborted) {
      throw new ApiError(408, 'The request timed out. Please try again.');
    }
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.', error);
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortFromExternal);
  }

  if (!response.ok) {
    const apiError = await toApiError(response);
    // A dead token must not leave the admin portal in a half-authenticated state.
    if (apiError.isUnauthorized) {
      clearAuthToken();
      notifyUnauthorized();
    }
    throw apiError;
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  try {
    return (text ? JSON.parse(text) : undefined) as T;
  } catch {
    throw new ApiError(
      response.status,
      'The server returned an unexpected non-JSON response. Please ensure the backend API service is running.'
    );
  }
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PUT', path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PATCH', path, body, options),
  delete: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('DELETE', path, body, options),

  /** Multipart upload. Kept separate so the JSON content-type is never forced on it. */
  upload: async <T>(path: string, formData: FormData, options: RequestOptions = {}): Promise<T> => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? UPLOAD_TIMEOUT_MS);
    const externalSignal = options.signal;
    const abortFromExternal = () => controller.abort();
    externalSignal?.addEventListener('abort', abortFromExternal);

    let response: Response;
    try {
      response = await fetch(buildUrl(path, options.query), {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted && !externalSignal?.aborted) {
        throw new ApiError(408, 'The upload timed out. Please try again.');
      }
      throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.', error);
    } finally {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', abortFromExternal);
    }

    if (!response.ok) {
      const apiError = await toApiError(response);
      if (apiError.isUnauthorized) {
        clearAuthToken();
        notifyUnauthorized();
      }
      throw apiError;
    }

    const text = await response.text();
    try {
      return (text ? JSON.parse(text) : undefined) as T;
    } catch {
      throw new ApiError(
        response.status,
        'The server returned an unexpected non-JSON response. Please ensure the backend API service is running.'
      );
    }
  },
};

/** Turns any thrown value into a message safe to show to an end user. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Absolute URL for a server-relative asset path such as `/uploads/abc.webp`. */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url;
  return `${BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;
}
