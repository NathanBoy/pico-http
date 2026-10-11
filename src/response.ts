/**
 * A normalized, fully-parsed HTTP response.
 *
 * Unlike the raw `fetch` `Response`, this object has already consumed the body
 * according to the request's `responseType`, so `body` is the parsed payload
 * (e.g. a deserialized JSON value) rather than a stream you must read yourself.
 */

import type { HeaderBag } from './headers.js';
import type { HttpMethod } from './request.js';

export class Response<T = unknown> {
  /** HTTP status code (e.g. 200). */
  readonly status: number;
  /** HTTP status text (e.g. "OK"). */
  readonly statusText: string;
  /** Response headers. */
  readonly headers: HeaderBag;
  /** Parsed response body. */
  readonly body: T;
  /** The final request URL. */
  readonly url: string;
  /** The HTTP method that produced this response. */
  readonly method?: HttpMethod;

  constructor(init: {
    status: number;
    statusText: string;
    headers: HeaderBag;
    body: T;
    url: string;
    method?: HttpMethod;
  }) {
    this.status = init.status;
    this.statusText = init.statusText;
    this.headers = init.headers;
    this.body = init.body;
    this.url = init.url;
    this.method = init.method;
  }

  /** `true` for any 2xx status. */
  get ok(): boolean {
    return this.status >= 200 && this.status < 300;
  }

  /** `true` for a redirect status (3xx). */
  get redirected(): boolean {
    return this.status >= 300 && this.status < 400;
  }

  /** `true` for a client-error status (4xx). */
  get clientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /** `true` for a server-error status (5xx). */
  get serverError(): boolean {
    return this.status >= 500 && this.status < 600;
  }
}
