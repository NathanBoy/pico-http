/**
 * Composes an ordered list of interceptors into a single dispatch function.
 *
 * Interceptors are combined right-to-left so that the first interceptor in the
 * list is the outermost layer: it sees the request first and the response last.
 */

import type { Interceptor, NextFn } from './interceptor.js';
import type { Transport } from './transport.js';

/**
 * Builds a dispatch function (`request -> Promise<Response>`) by wrapping the
 * given terminal transport with every interceptor in order.
 */
export function createPipeline(interceptors: readonly Interceptor[], transport: Transport): NextFn {
  const terminal: NextFn = (request) => transport(request);

  return interceptors.reduceRight<NextFn>((next, interceptor) => {
    return (request) => interceptor.handle(request, next);
  }, terminal);
}
