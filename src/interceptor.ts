/**
 * Interceptor contract — an onion-style middleware chain.
 *
 * An interceptor sits between the caller and the transport. It receives the
 * {@link Request} and a `next` function that forwards to the following layer
 * (eventually reaching the transport). Code before `await next(...)` runs on
 * the request path; code after it runs on the response/error path. This lets a
 * single interceptor observe, mutate, retry or short-circuit at either side.
 *
 * The pipeline is composed right-to-left, so the first interceptor in the
 * array is the outermost layer.
 */

import type { Request } from './request.js';
import type { Response } from './response.js';

/** Forwards a request to the next layer of the pipeline. */
export type NextFn = (request: Request) => Promise<Response<unknown>>;

/** A single layer of the request pipeline. */
export interface Interceptor {
  /**
   * Optional short name, used by tooling such as the logger to identify the
   * layer when reporting latency or errors.
   */
  name?: string;
  /** Handle a request, optionally delegating to `next`. */
  handle(request: Request, next: NextFn): Promise<Response<unknown>>;
}
