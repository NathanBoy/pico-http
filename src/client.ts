/**
 * `PicoClient` — the primary entry point.
 *
 * A client bundles a base URL, default headers/query, an ordered interceptor
 * pipeline and a transport into one convenient object with typed convenience
 * methods (`get`, `post`, ...). It is cheap to construct; create one per
 * API/service with its own defaults.
 */

import { Request, type HttpMethod, type RequestOptions } from './request.js';
import { Response } from './response.js';
import { HttpError } from './error.js';
import { HeaderBag, type HeaderInput } from './headers.js';
import { QueryParams, type QueryInput } from './params.js';
import type { Interceptor } from './interceptor.js';
import type { NextFn } from './interceptor.js';
import type { Transport } from './transport.js';
import { fetchTransport } from './transport.js';
import { createPipeline } from './pipeline.js';

export interface PicoClientOptions {
  /** Prefix applied to relative request URLs. */
  baseUrl?: string;
  /** Ordered interceptors; the first is the outermost layer. */
  interceptors?: readonly Interceptor[];
  /** Terminal transport. Defaults to {@link fetchTransport}. */
  transport?: Transport;
  /** Headers applied to every request (per-request headers win). */
  defaultHeaders?: HeaderInput;
  /** Query params applied to every request (per-request params win). */
  defaultQuery?: QueryInput;
  /** Whether non-2xx responses throw {@link HttpError}. Defaults to `false`. */
  throwHttpErrors?: boolean;
  /** Default timeout in ms for requests that don't set their own. */
  defaultTimeout?: number;
}

function ensureTrailingSlash(base: string): string {
  return base.endsWith('/') ? base : `${base}/`;
}

export class PicoClient {
  readonly baseUrl: string;
  readonly defaultHeaders: HeaderBag;
  readonly defaultQuery: QueryParams;
  readonly throwHttpErrors: boolean;
  readonly defaultTimeout?: number;

  private readonly handler: NextFn;

  constructor(options: PicoClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? '';
    this.defaultHeaders = new HeaderBag(options.defaultHeaders);
    this.defaultQuery = new QueryParams(options.defaultQuery);
    this.throwHttpErrors = options.throwHttpErrors ?? false;
    this.defaultTimeout = options.defaultTimeout;

    const transport: Transport =
      options.transport ?? cachedTransport;
    this.handler = createPipeline(options.interceptors ?? [], transport);
  }

  /**
   * Core dispatch. Accepts a pre-built {@link Request} or a URL plus options.
   */
  async request<T = unknown>(input: Request | string, init: RequestOptions = {}): Promise<Response<T>> {
    const url = input instanceof Request ? input.url : input;
    const resolved = this.resolveUrl(url);

    // Defaults form the base layer; request-specific options overlay them.
    let final = new Request(resolved, {
      headers: this.defaultHeaders,
      query: this.defaultQuery,
    });
    if (input instanceof Request) {
      final = final.with({ ...requestToOptions(input) });
    } else {
      final = final.with(init);
    }
    if (final.timeout == null && this.defaultTimeout != null) {
      final = final.with({ timeout: this.defaultTimeout });
    }

    const response = await this.handler(final);

    if (this.throwHttpErrors && !response.ok) {
      throw new HttpError(response);
    }
    return response as Response<T>;
  }

  get<T = unknown>(url: string, init: RequestOptions = {}): Promise<Response<T>> {
    return this.request<T>(url, { ...init, method: 'GET' });
  }

  post<T = unknown>(url: string, body?: unknown, init: RequestOptions = {}): Promise<Response<T>> {
    return this.request<T>(url, { ...init, method: 'POST', body });
  }

  put<T = unknown>(url: string, body?: unknown, init: RequestOptions = {}): Promise<Response<T>> {
    return this.request<T>(url, { ...init, method: 'PUT', body });
  }

  patch<T = unknown>(url: string, body?: unknown, init: RequestOptions = {}): Promise<Response<T>> {
    return this.request<T>(url, { ...init, method: 'PATCH', body });
  }

  delete<T = unknown>(url: string, init: RequestOptions = {}): Promise<Response<T>> {
    return this.request<T>(url, { ...init, method: 'DELETE' });
  }

  head<T = unknown>(url: string, init: RequestOptions = {}): Promise<Response<T>> {
    return this.request<T>(url, { ...init, method: 'HEAD' });
  }

  options<T = unknown>(url: string, init: RequestOptions = {}): Promise<Response<T>> {
    return this.request<T>(url, { ...init, method: 'OPTIONS' });
  }

  /** Resolves a possibly-relative URL against `baseUrl`. */
  resolveUrl(url: string): string {
    if (!this.baseUrl) return url;
    if (/^[a-z][a-z\d+\-.]*:\/\//i.test(url)) return url;
    return new URL(url, ensureTrailingSlash(this.baseUrl)).toString();
  }
}

function requestToOptions(request: Request): RequestOptions {
  return {
    method: request.method,
    headers: request.headers,
    query: request.query,
    body: request.body,
    timeout: request.timeout,
    signal: request.signal,
    responseType: request.responseType,
    credentials: request.credentials,
    cache: request.cache,
    redirect: request.redirect,
    mode: request.mode,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    integrity: request.integrity,
    keepalive: request.keepalive,
  };
}

// Deferred import avoids a circular dependency at module-evaluation time.
const cachedTransport: Transport = fetchTransport();


export type { HttpMethod, RequestOptions };
