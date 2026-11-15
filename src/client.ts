import { createHash } from 'node:crypto';
import { ApiError, LiandiError } from './errors.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT';

export interface ApiRequest {
  method: HttpMethod;
  path: string;
  query?: Record<string, string | number>;
  body?: Record<string, unknown>;
  cookieToken?: string;
}

export interface ClientOptions {
  baseUrl: string;
  version: string;
  token?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export interface RequestOptions {
  /** Reject locally when no token is configured for a login-only endpoint. */
  auth?: boolean;
  /** Omit Authorization even when a token exists (login and 2FA use their own flow). */
  suppressAuth?: boolean;
}

export class LiandiClient {
  private readonly fetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: ClientOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  get userAgent(): string {
    return `liandi/${this.options.version} (+https://github.com/wmy2981/liandi-cli)`;
  }

  url(request: ApiRequest): string {
    const url = new URL(this.options.baseUrl + request.path);
    for (const [key, value] of Object.entries(request.query ?? {})) {
      url.searchParams.set(key, String(value));
    }
    return url.href;
  }

  headers(request: ApiRequest, requireAuth = false, suppressAuth = false): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': this.userAgent,
    };
    if (requireAuth && !this.options.token) {
      throw new LiandiError('API token required. Set --token, LIANDI_TOKEN, ./.env, or ~/.config/liandi/.env', 'AUTH_REQUIRED', 2);
    }
    // Send the token on every call when available: many endpoints that accept
    // anonymous requests behave differently (or reject) without it.
    if (this.options.token && !suppressAuth) headers.Authorization = `token ${this.options.token}`;
    if (request.body !== undefined) headers['Content-Type'] = 'application/json; charset=utf-8';
    if (request.cookieToken) headers.Cookie = `symphony=${request.cookieToken}`;
    return headers;
  }

  async call<T = unknown>(request: ApiRequest, options: RequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetch(this.url(request), {
        method: request.method,
        headers: this.headers(request, options.auth, options.suppressAuth),
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        signal: controller.signal,
      });
      const text = await response.text();
      let data: unknown;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          throw new ApiError(`Server returned non-JSON response (HTTP ${response.status})`, response.status, text.slice(0, 500));
        }
      }
      if (!response.ok) throw new ApiError(`Request failed with HTTP ${response.status}`, response.status, data);
      return data as T;
    } catch (error) {
      if (error instanceof LiandiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new LiandiError(`Request timed out after ${this.timeoutMs}ms`, 'TIMEOUT');
      }
      throw new LiandiError('Network request failed', 'NETWORK_ERROR');
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function md5(value: string): string {
  return createHash('md5').update(value, 'utf8').digest('hex');
}
