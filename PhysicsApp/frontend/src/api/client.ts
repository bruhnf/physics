/**
 * Tiny fetch wrapper that knows the API base URL.
 *
 * Dev: detects the Metro host (same machine the phone is talking to over
 * Wi-Fi) and assumes the backend is on port 4000 there. Override via
 * EXPO_PUBLIC_API_BASE_URL env var if you need to point somewhere else.
 *
 * Production: must have EXPO_PUBLIC_API_BASE_URL baked in at build time
 * pointing at the deployed backend (Lightsail later).
 */
import Constants from 'expo-constants';

const BACKEND_PORT = 4000;

function defaultDevApiUrl(): string {
  // expoConfig.hostUri looks like "192.168.1.42:8081" when the phone is
  // talking to Metro on Wi-Fi, or "localhost:8081" on simulator.
  const hostUri = Constants.expoConfig?.hostUri ?? '';
  const host = hostUri.split(':')[0] || 'localhost';
  return `http://${host}:${BACKEND_PORT}`;
}

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? defaultDevApiUrl();

export type ApiResponse<T> = { success: true; data: T } | { success: false; error: string };

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Fetch JSON from the backend with a uniform error shape.
 * Throws ApiError on network failure, non-2xx response, or { success: false } body.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network request failed';
    throw new ApiError(`Fetch failed: ${message}`, undefined, url);
  }

  if (!res.ok) {
    throw new ApiError(`HTTP ${res.status}`, res.status, url);
  }

  let body: ApiResponse<T>;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError('Response was not valid JSON', res.status, url);
  }

  if (!body.success) {
    throw new ApiError(body.error, res.status, url);
  }
  return body.data;
}
