import { describe, it, expect } from 'vitest';
import { fetchTransport, Request, HeaderBag, TimeoutError, NetworkError } from '../src/index.js';

type MockFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

describe('fetchTransport', () => {
  it('parses a JSON response body', async () => {
    const mockFetch: MockFetch = async () =>
      new Response(JSON.stringify({ hello: 'world' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    const transport = fetchTransport({ fetch: mockFetch });
    const req = new Request('https://api.example.com/x');
    const res = await transport(req);
    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
    expect(res.body).toEqual({ hello: 'world' });
    expect(res.url).toBe('https://api.example.com/x');
  });

  it('JSON-encodes object bodies and sets content-type', async () => {
    let captured: RequestInit | undefined;
    const mockFetch: MockFetch = async (_url, init) => {
      captured = init;
      return new Response('{}', { status: 200 });
    };
    const transport = fetchTransport({ fetch: mockFetch });
    await transport(new Request('/x', { method: 'POST', body: { a: 1 } }));
    expect(captured?.body).toBe('{"a":1}');
    expect((captured?.headers as Headers)?.get('content-type')).toBe('application/json');
  });

  it('keeps an explicitly set content-type', async () => {
    let captured: RequestInit | undefined;
    const mockFetch: MockFetch = async (_url, init) => {
      captured = init;
      return new Response('', { status: 200 });
    };
    const transport = fetchTransport({ fetch: mockFetch });
    await transport(
      new Request('/x', {
        method: 'POST',
        body: { a: 1 },
        headers: { 'content-type': 'application/vnd.api+json' },
      }),
    );
    expect((captured?.headers as Headers)?.get('content-type')).toBe('application/vnd.api+json');
  });

  it('parses text bodies with responseType text', async () => {
    const mockFetch: MockFetch = async () => new Response('plain text', { status: 200 });
    const transport = fetchTransport({ fetch: mockFetch });
    const res = await transport(new Request('/x', { responseType: 'text' }));
    expect(res.body).toBe('plain text');
  });

  it('returns undefined body for 204 responses', async () => {
    const mockFetch: MockFetch = async () => new Response(null, { status: 204 });
    const transport = fetchTransport({ fetch: mockFetch });
    const res = await transport(new Request('/x'));
    expect(res.body).toBeUndefined();
  });

  it('does not throw on non-2xx by default', async () => {
    const mockFetch: MockFetch = async () =>
      new Response('nope', { status: 404, statusText: 'Not Found' });
    const transport = fetchTransport({ fetch: mockFetch });
    const res = await transport(new Request('/x'));
    expect(res.status).toBe(404);
    expect(res.ok).toBe(false);
  });

  it('throws TimeoutError when the request exceeds the timeout', async () => {
    const mockFetch: MockFetch = async (_url, init) =>
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(new Response('{}', { status: 200 })), 100);
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    const transport = fetchTransport({ fetch: mockFetch });
    await expect(transport(new Request('/x', { timeout: 10 }))).rejects.toBeInstanceOf(
      TimeoutError,
    );
  });

  it('throws NetworkError when fetch rejects', async () => {
    const mockFetch: MockFetch = async () => {
      throw new TypeError('fetch failed');
    };
    const transport = fetchTransport({ fetch: mockFetch });
    await expect(transport(new Request('/x'))).rejects.toBeInstanceOf(NetworkError);
  });

  it('drops the body for GET requests', async () => {
    let captured: RequestInit | undefined;
    const mockFetch: MockFetch = async (_url, init) => {
      captured = init;
      return new Response('', { status: 200 });
    };
    const transport = fetchTransport({ fetch: mockFetch });
    await transport(new Request('/x', { body: { a: 1 } }));
    expect(captured?.body).toBeUndefined();
  });

  it('captures response headers into a HeaderBag', async () => {
    const mockFetch: MockFetch = async () =>
      new Response('{}', { status: 200, headers: { 'x-request-id': 'abc' } });
    const transport = fetchTransport({ fetch: mockFetch });
    const res = await transport(new Request('/x'));
    expect(res.headers).toBeInstanceOf(HeaderBag);
    expect(res.headers.get('x-request-id')).toBe('abc');
  });

  it('combines an external signal with a timeout and cancels on external abort', async () => {
    const mockFetch: MockFetch = async (_url, init) =>
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(new Response('{}', { status: 200 })), 5000);
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });

    const runWithAny = async (): Promise<boolean> => {
      const transport = fetchTransport({ fetch: mockFetch });
      const ctrl = new AbortController();
      const pending = transport(new Request('/x', { timeout: 10000, signal: ctrl.signal }));
      ctrl.abort();
      await expect(pending).rejects.toBeInstanceOf(NetworkError);
      return true;
    };

    // Native path.
    await runWithAny();

    // Fallback path (AbortSignal.any unavailable, e.g. Node < 20.3).
    const original = (AbortSignal as { any?: typeof AbortSignal.any }).any;
    try {
      (AbortSignal as { any?: typeof AbortSignal.any }).any = undefined as never;
      await runWithAny();
    } finally {
      (AbortSignal as { any?: typeof AbortSignal.any }).any = original;
    }
  });
});
