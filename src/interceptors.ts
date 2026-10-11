/**
 * Built-in interceptors for common concerns: retry and logging.
 *
 * These are opt-in layers — you compose the ones you need into your client.
 * The retry interceptor demonstrates the onion model nicely: it wraps `next`
 * in a loop and only retries when the inner layers reject.
 */

import type { Interceptor } from './interceptor.js';
import { HttpError, NetworkError, TimeoutError } from './error.js';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface RetryOptions {
  /** Maximum number of retries after the first attempt. Defaults to `3`. */
  retries?: number;
  /**
   * Base delay in ms, or a function `(attempt, error) => ms` for full control.
   * Defaults to exponential backoff starting at `200ms`.
   */
  delay?: number | ((attempt: number, error: unknown) => number);
  /**
   * Custom decision predicate. Receives the error and the zero-based attempt
   * index. Defaults to retrying network/timeout failures and 5xx/429 responses.
   */
  retryOn?: (error: unknown, attempt: number) => boolean;
}

const defaultShouldRetry = (error: unknown): boolean => {
  if (error instanceof NetworkError || error instanceof TimeoutError) return true;
  if (error instanceof HttpError) return error.status >= 500 || error.status === 429;
  return false;
};

/**
 * Retries a request on transient failures with exponential backoff.
 */
export function retryInterceptor(options: RetryOptions = {}): Interceptor {
  const { retries = 3, delay = 200, retryOn } = options;

  return {
    name: 'retry',
    async handle(request, next) {
      let attempt = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          return await next(request);
        } catch (error) {
          const shouldRetry = retryOn ? retryOn(error, attempt) : defaultShouldRetry(error);
          if (!shouldRetry || attempt >= retries) throw error;
          const wait = typeof delay === 'function' ? delay(attempt, error) : (delay as number) * 2 ** attempt;
          if (wait > 0) await sleep(wait);
          attempt += 1;
        }
      }
    },
  };
}

/** Minimal logger interface. `console` satisfies it. */
export interface Logger {
  log(...args: unknown[]): void;
  info?(...args: unknown[]): void;
  warn?(...args: unknown[]): void;
  error?(...args: unknown[]): void;
}

/**
 * Logs each request, its status and latency. Useful in development and for
 * debugging pipelines.
 */
export function loggerInterceptor(logger: Logger = console): Interceptor {
  return {
    name: 'logger',
    async handle(request, next) {
      const started = performance.now();
      logger.log?.('[pico-http] →', request.method, request.fullUrl);
      try {
        const response = await next(request);
        const ms = performance.now() - started;
        logger.log?.(
          '[pico-http] ←',
          response.status,
          request.method,
          request.fullUrl,
          `${ms.toFixed(1)}ms`,
        );
        return response;
      } catch (error) {
        const ms = performance.now() - started;
        logger.error?.(
          '[pico-http] ✕',
          request.method,
          request.fullUrl,
          `${ms.toFixed(1)}ms`,
          error,
        );
        throw error;
      }
    },
  };
}
