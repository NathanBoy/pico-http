/**
 * Transport layer — the terminal end of the pipeline that actually issues the
 * request. The default implementation wraps the native `fetch` API, handling
 * body encoding, timeout, abort propagation and body parsing. Because it is a
 * plain function, it is trivially replaceable with a mock in tests.
 */

import type { Request, ResponseType } from './request.js';
import { Response as HttpResponse } from './response.js';
import { NetworkError, TimeoutError } from './error.js';
import { HeaderBag } from './headers.js';

/**
 * A terminal transport: takes a fully-resolved request and returns a parsed
 * response. This is the seam between the pipeline and the outside world.
 */
export type Transport = (request: Request) => Promise<HttpResponse<unknown>>;

export interface FetchTransportOptions {
  /** Custom fetch implementation (useful for tests and runtimes). */
  fetch?: typeof fetch;
}

/** Anything that can be handed directly to `fetch` as a body. */
type NativeBody = BodyInit | null;

function isJsonLike(value: unknown): value is Record<string, unknown> | unknown[] {
  if (value === null || typeof value !== 'object') return false;
  return !(
    value instanceof FormData ||
    value instanceof Blob ||
    value instanceof ArrayBuffer ||
    value instanceof URLSearchParams ||
    value instanceof ReadableStream ||
    ArrayBuffer.isView(value)
  );
}

/** Encodes a request body and ensures a matching `Content-Type` header. */
function encodeBody(body: unknown, headers: HeaderBag): { body: NativeBody; headers: HeaderBag } {
  if (body === null || body === undefined) {
    return { body: null, headers };
  }
  if (typeof body === 'string') {
    return { body, headers };
  }
  if (isJsonLike(body)) {
    let next = headers;
    if (!headers.has('content-type')) {
      next = headers.set('content-type', 'application/json');
    }
    return { body: JSON.stringify(body), headers: next };
  }
  // FormData / Blob / ArrayBuffer / URLSearchParams / stream etc.
  return { body: body as BodyInit, headers };
}

/** Builds a native `Headers` from the immutable bag. */
function toNativeHeaders(headers: HeaderBag): Headers {
  return headers.toHeaders();
}

/**
 * Creates a default transport backed by `fetch`.
 */
export function fetchTransport(options: FetchTransportOptions = {}): Transport {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);

  return async (request: Request): Promise<HttpResponse<unknown>> => {
    const { body, headers } = encodeBody(request.body, request.headers);
    const method = request.method;
    // GET/HEAD carry no body in practice; drop it to avoid fetch errors.
    const finalBody = method === 'GET' || method === 'HEAD' ? null : body;

    const fetchInit: RequestInit = {
      method,
      headers: toNativeHeaders(headers),
      redirect: request.redirect ?? 'follow',
      ...(request.credentials !== undefined && { credentials: request.credentials }),
      ...(request.cache !== undefined && { cache: request.cache }),
      ...(request.mode !== undefined && { mode: request.mode }),
      ...(request.referrer !== undefined && { referrer: request.referrer }),
      ...(request.referrerPolicy !== undefined && { referrerPolicy: request.referrerPolicy }),
      ...(request.integrity !== undefined && { integrity: request.integrity }),
      ...(request.keepalive !== undefined && { keepalive: request.keepalive }),
      ...(finalBody != null && { body: finalBody }),
    };

    const controller = new AbortController();
    const hasExternal = !!request.signal;
    const hasTimeout = request.timeout != null && request.timeout > 0;

    if (hasExternal && hasTimeout) {
      fetchInit.signal = AbortSignal.any([request.signal!, controller.signal]);
    } else if (hasTimeout) {
      fetchInit.signal = controller.signal;
    } else if (hasExternal) {
      fetchInit.signal = request.signal;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (hasTimeout) {
      timer = setTimeout(() => controller.abort(), request.timeout);
    }

    try {
      const raw = await doFetch(request.fullUrl, fetchInit);
      const body = await parseBody(raw, request.responseType);
      return new HttpResponse<unknown>({
        status: raw.status,
        statusText: raw.statusText,
        headers: new HeaderBag(raw.headers),
        body,
        url: raw.url || request.fullUrl,
        method: request.method,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        throw new TimeoutError(request.fullUrl, request.method, request.timeout ?? 0);
      }
      if (request.signal?.aborted) {
        throw new NetworkError(request.fullUrl, request.method, err);
      }
      throw new NetworkError(request.fullUrl, request.method, err);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
}

async function parseBody(raw: Response, responseType: ResponseType): Promise<unknown> {
  switch (responseType) {
    case 'raw':
      return raw;
    case 'stream':
      return raw.body;
    case 'blob':
      return await raw.blob();
    case 'arrayBuffer':
      return await raw.arrayBuffer();
    case 'text':
      return await raw.text();
    case 'json':
    default: {
      const text = await raw.text();
      if (!text.trim()) return undefined;
      try {
        return JSON.parse(text);
      } catch {
        // The body wasn't JSON (e.g. an HTML error page). If the server didn't
        // claim JSON, return the raw text so callers can inspect it; otherwise
        // surface the parse failure rather than swallowing it.
        const type = raw.headers.get('content-type') ?? '';
        if (!type.toLowerCase().includes('json')) return text;
        return text;
      }
    }
  }
}

