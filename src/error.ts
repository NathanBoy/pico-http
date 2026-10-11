/**
 * Error hierarchy for pico-http.
 *
 * All failures produced by the client are instances of `RequestError`, with
 * more specific subclasses for the three common cases:
 *  - `TimeoutError`  — the request exceeded its timeout budget.
 *  - `NetworkError`  — the transport layer failed before a response arrived.
 *  - `HttpError`     — a response arrived but was considered an error
 *                      (non-2xx when `throwHttpErrors` is enabled).
 */

import type { Response } from './response.js';

export class RequestError extends Error {
  /** The request URL that failed. */
  readonly url: string;
  /** The HTTP method of the failed request, when known. */
  readonly method?: string;

  constructor(message: string, url: string, method?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.url = url;
    this.method = method;
  }
}

export class TimeoutError extends RequestError {
  /** The configured timeout in milliseconds. */
  readonly timeout: number;

  constructor(url: string, method: string | undefined, timeout: number) {
    super(`Request to "${url}" timed out after ${timeout}ms.`, url, method);
    this.timeout = timeout;
  }
}

export class NetworkError extends RequestError {
  constructor(url: string, method: string | undefined, cause: unknown) {
    super(
      `Network request to "${url}" failed: ${cause instanceof Error ? cause.message : String(cause)}.`,
      url,
      method,
      { cause },
    );
  }
}

export class HttpError extends RequestError {
  /** The HTTP status code. */
  readonly status: number;
  /** The HTTP status text. */
  readonly statusText: string;
  /** The failing response, when it could be parsed. */
  readonly response?: Response<unknown>;

  constructor(response: Response<unknown>, message?: string) {
    super(
      message ??
        `Request to "${response.url}" failed with status ${response.status} ${response.statusText}.`.trim(),
      response.url,
      response.method,
    );
    this.status = response.status;
    this.statusText = response.statusText;
    this.response = response;
  }
}
