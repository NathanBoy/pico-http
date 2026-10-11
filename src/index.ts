/**
 * pico-http — a tiny, zero-dependency, type-safe HTTP client.
 *
 * Public surface: everything importable from the package is exported here.
 *
 * @packageDocumentation
 */

export { PicoClient, type PicoClientOptions } from './client.js';
export { Request, type RequestOptions, type HttpMethod, type ResponseType } from './request.js';
export { Response } from './response.js';
export { HeaderBag, EMPTY_HEADERS, type HeaderInput } from './headers.js';
export { QueryParams, EMPTY_PARAMS, type QueryInput, type QueryValue } from './params.js';
export { RequestError, TimeoutError, NetworkError, HttpError } from './error.js';
export { createPipeline } from './pipeline.js';
export { fetchTransport, type Transport, type FetchTransportOptions } from './transport.js';
export {
  retryInterceptor,
  loggerInterceptor,
  type RetryOptions,
  type Logger,
} from './interceptors.js';
export type { Interceptor, NextFn } from './interceptor.js';
