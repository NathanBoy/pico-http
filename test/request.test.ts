import { describe, it, expect } from 'vitest';
import { Request } from '../src/index.js';

describe('Request', () => {
  it('normalizes method to uppercase', () => {
    expect(new Request('/x', { method: 'GET' }).method).toBe('GET');
    expect(new Request('/x', { method: 'POST' }).method).toBe('POST');
    expect(new Request('/x').method).toBe('GET');
  });

  it('builds fullUrl with query string', () => {
    const r = new Request('/api/users', { query: { page: '2', tag: ['a', 'b'] } });
    expect(r.fullUrl).toBe('/api/users?page=2&tag=a&tag=b');
  });

  it('appends query to an existing query string in url', () => {
    const r = new Request('/x?a=1', { query: { b: '2' } });
    expect(r.fullUrl).toBe('/x?a=1&b=2');
  });

  it('returns url unchanged when no query', () => {
    const r = new Request('/x');
    expect(r.fullUrl).toBe('/x');
  });

  it('with() overlays headers immutably', () => {
    const r = new Request('/x', { headers: { a: '1' } });
    const next = r.with({ headers: { b: '2' } });
    expect(r.headers.has('b')).toBe(false);
    expect(next.headers.get('a')).toBe('1');
    expect(next.headers.get('b')).toBe('2');
  });

  it('with() overlays query immutably, extra wins', () => {
    const r = new Request('/x', { query: { a: '1', keep: 'yes' } });
    const next = r.with({ query: { a: '2' } });
    expect(r.query.get('a')).toBe('1');
    expect(next.query.get('a')).toBe('2');
    expect(next.query.get('keep')).toBe('yes');
  });

  it('with() overlays body only when provided', () => {
    const r = new Request('/x', { body: { a: 1 } });
    const next = r.with({ headers: { b: '2' } });
    expect(next.body).toEqual({ a: 1 });
    const changed = r.with({ body: null });
    expect(changed.body).toBeNull();
  });

  it('setHeader returns a new request', () => {
    const r = new Request('/x', { headers: { a: '1' } });
    const next = r.setHeader('a', '2');
    expect(r.headers.get('a')).toBe('1');
    expect(next.headers.get('a')).toBe('2');
  });

  it('clone produces an independent equal request', () => {
    const r = new Request('/x', { method: 'POST', headers: { a: '1' }, query: { q: '2' } });
    const c = r.clone();
    expect(c.fullUrl).toBe(r.fullUrl);
    expect(c.method).toBe(r.method);
    expect(c === r).toBe(false);
    expect(c.headers === r.headers).toBe(false);
  });

  it('stores fetch-related options', () => {
    const r = new Request('/x', { credentials: 'include', timeout: 5000, responseType: 'text' });
    expect(r.credentials).toBe('include');
    expect(r.timeout).toBe(5000);
    expect(r.responseType).toBe('text');
  });

  it('defaults responseType to json', () => {
    expect(new Request('/x').responseType).toBe('json');
  });
});
