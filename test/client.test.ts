import { describe, it, expect } from 'vitest';
import { PicoClient, Request, Response, HeaderBag, HttpError } from '../src/index.js';

type Echo = { url: string; method: string };

const okTransport = async (r: Request): Promise<Response<Echo>> =>
  new Response<Echo>({
    status: 200,
    statusText: 'OK',
    headers: new HeaderBag(),
    body: { url: r.fullUrl, method: r.method },
    url: r.fullUrl,
    method: r.method,
  });

describe('PicoClient', () => {
  it('dispatches a GET with the correct method', async () => {
    const client = new PicoClient({ transport: okTransport });
    const res = await client.get<Echo>('/users');
    expect(res.body).toEqual({ url: '/users', method: 'GET' });
  });

  it('dispatches POST with a body', async () => {
    const client = new PicoClient({ transport: okTransport });
    const res = await client.post<Echo>('/users', { name: 'pico' });
    expect(res.body.method).toBe('POST');
  });

  it('resolves relative URLs against baseUrl', async () => {
    const client = new PicoClient({
      baseUrl: 'https://api.example.com/v1',
      transport: okTransport,
    });
    const res = await client.get<Echo>('users');
    expect(res.body.url).toBe('https://api.example.com/v1/users');
  });

  it('does not rewrite absolute URLs when baseUrl is set', async () => {
    const client = new PicoClient({
      baseUrl: 'https://api.example.com/v1',
      transport: okTransport,
    });
    const res = await client.get<Echo>('https://other.example.com/x');
    expect(res.body.url).toBe('https://other.example.com/x');
  });

  it('applies default headers and lets per-request headers win', async () => {
    const seen: Record<string, string | null> = {};
    const transport = async (r: Request) => {
      seen.auth = r.headers.get('x-auth');
      seen.accept = r.headers.get('accept');
      return okTransport(r);
    };
    const client = new PicoClient({
      transport,
      defaultHeaders: { 'x-auth': 'default', accept: 'application/json' },
    });
    await client.get('/x', { headers: { 'x-auth': 'override' } });
    expect(seen.auth).toBe('override');
    expect(seen.accept).toBe('application/json');
  });

  it('applies default query params', async () => {
    const client = new PicoClient({ transport: okTransport, defaultQuery: { apiKey: 'k' } });
    const res = await client.get<Echo>('/x');
    expect(res.body.url).toBe('/x?apiKey=k');
  });

  it('throws HttpError when throwHttpErrors is enabled and status is non-2xx', async () => {
    const transport = async () =>
      new Response({
        status: 500,
        statusText: 'Server Error',
        headers: new HeaderBag(),
        body: null,
        url: '/x',
        method: 'GET',
      });
    const client = new PicoClient({ transport, throwHttpErrors: true });
    await expect(client.get('/x')).rejects.toBeInstanceOf(HttpError);
  });

  it('returns non-2xx responses when throwHttpErrors is disabled', async () => {
    const transport = async () =>
      new Response({
        status: 404,
        statusText: 'Not Found',
        headers: new HeaderBag(),
        body: null,
        url: '/x',
        method: 'GET',
      });
    const client = new PicoClient({ transport });
    const res = await client.get('/x');
    expect(res.status).toBe(404);
  });

  it('runs interceptors around the transport', async () => {
    const order: string[] = [];
    const interceptor = {
      name: 'trace',
      async handle(r: Request, next: (r: Request) => Promise<Response>) {
        order.push('before');
        const res = await next(r);
        order.push('after');
        return res;
      },
    };
    const client = new PicoClient({ transport: okTransport, interceptors: [interceptor] });
    await client.get('/x');
    expect(order).toEqual(['before', 'after']);
  });

  it('accepts a pre-built Request', async () => {
    const client = new PicoClient({ transport: okTransport });
    const res = await client.request<Echo>(new Request('/prebuilt', { method: 'DELETE' }));
    expect(res.body).toEqual({ url: '/prebuilt', method: 'DELETE' });
  });

  it('exposes head/put/patch/delete/options helpers', async () => {
    const client = new PicoClient({ transport: okTransport });
    expect((await client.head<Echo>('/h')).body.method).toBe('HEAD');
    expect((await client.put<Echo>('/p', { a: 1 })).body.method).toBe('PUT');
    expect((await client.patch<Echo>('/p', { a: 1 })).body.method).toBe('PATCH');
    expect((await client.delete<Echo>('/d')).body.method).toBe('DELETE');
    expect((await client.options<Echo>('/o')).body.method).toBe('OPTIONS');
  });

  it('is typed through the generic request/helpers', async () => {
    interface User {
      id: number;
      name: string;
    }
    const client = new PicoClient({ transport: okTransport });
    const res = await client.get<User>('/users/1');
    // At runtime the body is the mock; the type is what we assert here.
    expect(typeof (res.body as Partial<User>)).toBe('object');
  });
});
