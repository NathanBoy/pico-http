/**
 * Immutable request description.
 *
 * A `Request` is the single object that flows through the interceptor
 * pipeline. It bundles the URL, method, headers, query params, body and the
 * subset of `fetch` options pico-http cares about, and is immutable: every
 * `with*`/`clone` operation returns a fresh instance so interceptors can
 * derive variants without mutating shared state.
 */

import { HeaderBag, type HeaderInput } from './headers.js';
import { QueryParams, type QueryInput } from './params.js';

/** Supported HTTP methods. */
export type HttpMethod =
  'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'CONNECT' | 'TRACE';

/** How the response body should be interpreted. */
export type ResponseType = 'json' | 'text' | 'blob' | 'arrayBuffer' | 'stream' | 'raw';

/** Options that configure a single request. */
export interface RequestOptions {
  method?: HttpMethod;
  /** Request headers, merged case-insensitively. */
  headers?: HeaderInput;
  /** Query params, appended to any query already present in `url`. */
  query?: QueryInput;
  /** The request body. Plain objects/arrays are JSON-encoded by default. */
  body?: unknown;
  /** Milliseconds before the request is aborted. */
  timeout?: number;
  /** External abort signal (e.g. a user cancel button). */
  signal?: AbortSignal;
  /** Response body interpretation. Defaults to `json`. */
  responseType?: ResponseType;
  credentials?: RequestCredentials;
  cache?: RequestCache;
  redirect?: RequestRedirect;
  mode?: RequestMode;
  referrer?: string;
  referrerPolicy?: ReferrerPolicy;
  integrity?: string;
  keepalive?: boolean;
  window?: null;
}

function normalizeMethod(method: string | undefined): HttpMethod {
  return (method ?? 'GET').toUpperCase() as HttpMethod;
}

export class Request {
  /** The request path/URL, without any query string. */
  readonly url: string;
  readonly method: HttpMethod;
  readonly headers: HeaderBag;
  readonly query: QueryParams;
  readonly body: unknown;
  readonly timeout?: number;
  readonly signal?: AbortSignal;
  readonly responseType: ResponseType;
  readonly credentials?: RequestCredentials;
  readonly cache?: RequestCache;
  readonly redirect?: RequestRedirect;
  readonly mode?: RequestMode;
  readonly referrer?: string;
  readonly referrerPolicy?: ReferrerPolicy;
  readonly integrity?: string;
  readonly keepalive?: boolean;
  readonly window?: null;

  constructor(url: string, options: RequestOptions = {}) {
    this.url = url;
    this.method = normalizeMethod(options.method);
    this.headers = new HeaderBag(options.headers);
    this.query = new QueryParams(options.query);
    this.body = options.body;
    this.timeout = options.timeout;
    this.signal = options.signal;
    this.responseType = options.responseType ?? 'json';
    this.credentials = options.credentials;
    this.cache = options.cache;
    this.redirect = options.redirect;
    this.mode = options.mode;
    this.referrer = options.referrer;
    this.referrerPolicy = options.referrerPolicy;
    this.integrity = options.integrity;
    this.keepalive = options.keepalive;
    this.window = options.window;
  }

  /**
   * The full URL including the encoded query string (e.g. `/api?a=1&b=2`).
   */
  get fullUrl(): string {
    const qs = this.query.toString();
    if (!qs) return this.url;
    const sep = this.url.includes('?') ? '&' : '?';
    return `${this.url}${sep}${qs}`;
  }

  /** Returns a copy of this request with the given options overlaid. */
  with(overrides: RequestOptions): Request {
    const merged: RequestOptions = {
      method: overrides.method ?? this.method,
      headers: mergeHeaders(this.headers, overrides.headers),
      query: mergeQuery(this.query, overrides.query),
      body: overrides.body !== undefined ? overrides.body : this.body,
      timeout: overrides.timeout ?? this.timeout,
      signal: overrides.signal ?? this.signal,
      responseType: overrides.responseType ?? this.responseType,
      credentials: overrides.credentials ?? this.credentials,
      cache: overrides.cache ?? this.cache,
      redirect: overrides.redirect ?? this.redirect,
      mode: overrides.mode ?? this.mode,
      referrer: overrides.referrer ?? this.referrer,
      referrerPolicy: overrides.referrerPolicy ?? this.referrerPolicy,
      integrity: overrides.integrity ?? this.integrity,
      keepalive: overrides.keepalive ?? this.keepalive,
      window: overrides.window ?? this.window,
    };
    return new Request(this.url, merged);
  }

  /**
   * Returns a copy with a single header replaced. This is syntactic sugar for
   * interceptors that only want to touch one header.
   */
  setHeader(name: string, value: string | readonly string[]): Request {
    return new Request(this.url, {
      method: this.method,
      headers: this.headers.set(name, value),
      query: this.query,
      body: this.body,
      timeout: this.timeout,
      signal: this.signal,
      responseType: this.responseType,
      credentials: this.credentials,
      cache: this.cache,
      redirect: this.redirect,
      mode: this.mode,
      referrer: this.referrer,
      referrerPolicy: this.referrerPolicy,
      integrity: this.integrity,
      keepalive: this.keepalive,
    });
  }

  /**
   * Returns an identical copy. Handy when an interceptor wants to "reset"
   * the chain to a known baseline.
   */
  clone(): Request {
    return new Request(this.url, {
      method: this.method,
      headers: this.headers,
      query: this.query,
      body: this.body,
      timeout: this.timeout,
      signal: this.signal,
      responseType: this.responseType,
      credentials: this.credentials,
      cache: this.cache,
      redirect: this.redirect,
      mode: this.mode,
      referrer: this.referrer,
      referrerPolicy: this.referrerPolicy,
      integrity: this.integrity,
      keepalive: this.keepalive,
    });
  }
}

function mergeHeaders(base: HeaderBag, extra: HeaderInput | undefined): HeaderInput {
  if (!extra) return base;
  const extraBag = new HeaderBag(extra);
  let merged = new HeaderBag(base);
  // Overlay: drop base keys that `extra` overrides, then append the extras.
  for (const key of extraBag.keys()) {
    merged = merged.delete(key);
  }
  for (const key of extraBag.keys()) {
    merged = merged.append(key, extraBag.getAll(key));
  }
  return merged;
}

function mergeQuery(base: QueryParams, extra: QueryInput | undefined): QueryInput {
  if (!extra) return base;
  const extraParams = new QueryParams(extra);
  // Start from base, drop keys overridden by `extra`, then append extra.
  let merged = new QueryParams(base);
  for (const key of extraParams.keys()) {
    merged = merged.delete(key);
  }
  for (const [k, v] of extraParams.toRawEntries()) {
    merged = merged.append(k, v);
  }
  return merged;
}
