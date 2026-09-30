import { ApiError, getAuthToken } from './api';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

/** The `YYYY-MM-DD` stamp every export filename carries. */
export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const url = `${BASE_URL}${path}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    params.append(key, String(value));
  }

  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

/** Server errors arrive as `{ error }`; anything else keeps the status-based text. */
async function toExportError(response: Response): Promise<ApiError> {
  let message = `Export failed with status ${response.status}`;
  try {
    const body: unknown = await response.json();
    const serverMessage = (body as { error?: unknown } | null)?.error;
    if (typeof serverMessage === 'string') message = serverMessage;
  } catch {
    // fallback
  }
  return new ApiError(response.status, message);
}

/** The server names the file; the caller only supplies what to use without it. */
function readFilename(disposition: string | null, fallbackName: string): string {
  if (!disposition) return fallbackName;
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match && match[1] ? match[1] : fallbackName;
}

/**
 * Fetches an authenticated export and hands it to the browser as a download.
 * The response body is a blob rather than JSON, so it bypasses `api` and builds
 * its own request.
 */
export async function downloadFile(
  path: string,
  fallbackName: string,
  query?: Record<string, string | number | undefined>
): Promise<void> {
  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(buildUrl(path, query), { headers });
  if (!response.ok) throw (await toExportError(response));

  const blob = await response.blob();
  const filename = readFilename(response.headers.get('Content-Disposition'), fallbackName);

  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoking in the same tick can cancel the download in some browsers.
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
}
