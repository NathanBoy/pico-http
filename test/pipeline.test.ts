import { describe, it, expect } from 'vitest';
import { createPipeline, Request, Response, HeaderBag } from '../src/index.js';

const req = new Request('/x');
const okTransport = async (r: Request) =>
  new Response({
    status: 200,
    statusText: 'OK',
    headers: new HeaderBag(),
    body: { ok: true },
    url: r.fullUrl,
    method: r.method,
  });

describe('createPipeline', () => {
  it('runs request path in order and response path in reverse', async () => {
    const order: string[] = [];
    const layer = (name: string) => ({
      name,
      async handle(r: Request, next: (r: Request) => Promise<Response>) {
        order.push(`${name}:req`);
        const res = await next(r);
        order.push(`${name}:res`);
        return res;
      },
    });

    const handler = createPipeline([layer('a'), layer('b')], okTransport);
    await handler(req);
    expect(order).toEqual(['a:req', 'b:req', 'b:res', 'a:res']);
  });

  it('allows an interceptor to short-circuit without calling next', async () => {
    const blocking = {
      name: 'block',
      async handle() {
        return new Response({
          status: 200,
          statusText: 'OK',
          headers: new HeaderBag(),
          body: { blocked: true },
          url: '/x',
          method: 'GET',
        });
      },
    };
    const handler = createPipeline([blocking], okTransport);
    const res = await handler(req);
    expect(res.body).toEqual({ blocked: true });
  });

  it('propagates errors thrown by inner layers', async () => {
    const boom = {
      name: 'boom',
      async handle() {
        throw new Error('inner boom');
      },
    };
    const handler = createPipeline([boom], okTransport);
    await expect(handler(req)).rejects.toThrow('inner boom');
  });

  it('lets an outer interceptor mutate the request for inner layers', async () => {
    const inject = {
      name: 'inject',
      async handle(r: Request, next: (r: Request) => Promise<Response>) {
        return next(r.setHeader('x-auth', 'secret'));
      },
    };
    const seen: string[] = [];
    const transport = async (r: Request) => {
      seen.push(r.headers.get('x-auth') ?? 'none');
      return okTransport(r);
    };
    const handler = createPipeline([inject], transport);
    await handler(req);
    expect(seen).toEqual(['secret']);
  });
});
