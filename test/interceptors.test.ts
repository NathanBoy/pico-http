import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  retryInterceptor,
  loggerInterceptor,
  createPipeline,
  Request,
  Response,
  HeaderBag,
  NetworkError,
  TimeoutError,
  HttpError,
} from '../src/index.js';

const req = new Request('/x');
const ok = async () =>
  new Response({
    status: 200,
    statusText: 'OK',
    headers: new HeaderBag(),
    body: { ok: true },
    url: '/x',
    method: 'GET',
  });

describe('retryInterceptor', () => {
  it('succeeds on a transient failure without exhausting retries', async () => {
    let calls = 0;
    const flaky = async () => {
      calls += 1;
      if (calls < 3) throw new NetworkError('/x', 'GET', new Error('down'));
      return ok();
    };
    const handler = createPipeline([retryInterceptor({ retries: 3, delay: 0 })], flaky);
    const res = await handler(req);
    expect(res.body).toEqual({ ok: true });
    expect(calls).toBe(3);
  });

  it('throws after exhausting retries', async () => {
    let calls = 0;
    const alwaysDown = async () => {
      calls += 1;
      throw new NetworkError('/x', 'GET', new Error('down'));
    };
    const handler = createPipeline([retryInterceptor({ retries: 2, delay: 0 })], alwaysDown);
    await expect(handler(req)).rejects.toBeInstanceOf(NetworkError);
    expect(calls).toBe(3);
  });

  it('does not retry non-transient errors', async () => {
    let calls = 0;
    const bad = async () => {
      calls += 1;
      throw new Error('not transient');
    };
    const handler = createPipeline([retryInterceptor({ retries: 5, delay: 0 })], bad);
    await expect(handler(req)).rejects.toThrow('not transient');
    expect(calls).toBe(1);
  });

  it('retries 5xx and 429 HttpError but not 4xx', async () => {
    const err = (status: number) =>
      new Response({ status, statusText: '', headers: new HeaderBag(), body: null, url: '/x', method: 'GET' });

    let fiveCalls = 0;
    const serverDown = async () => {
      fiveCalls += 1;
      throw new HttpError(err(503));
    };
    const retry5xx = createPipeline([retryInterceptor({ retries: 3, delay: 0 })], serverDown);
    await expect(retry5xx(req)).rejects.toBeInstanceOf(HttpError);
    expect(fiveCalls).toBe(4);

    let fourCalls = 0;
    const clientErr = async () => {
      fourCalls += 1;
      throw new HttpError(err(404));
    };
    const retry4xx = createPipeline([retryInterceptor({ retries: 3, delay: 0 })], clientErr);
    await expect(retry4xx(req)).rejects.toBeInstanceOf(HttpError);
    expect(fourCalls).toBe(1);
  });

  it('honors a custom retryOn predicate', async () => {
    let calls = 0;
    const always = async () => {
      calls += 1;
      throw new Error('anything');
    };
    const handler = createPipeline(
      [retryInterceptor({ retries: 1, delay: 0, retryOn: () => true })],
      always,
    );
    await expect(handler(req)).rejects.toThrow('anything');
    expect(calls).toBe(2);
  });
});

describe('loggerInterceptor', () => {
  beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('logs request and response', async () => {
    const handler = createPipeline([loggerInterceptor()], ok);
    await handler(req);
    expect(console.log).toHaveBeenCalled();
  });
});

// Keep TimeoutError referenced in this file so the import is meaningful.
void TimeoutError;
