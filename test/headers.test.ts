import { describe, it, expect } from 'vitest';
import { HeaderBag, EMPTY_HEADERS } from '../src/index.js';

describe('HeaderBag', () => {
  it('is empty by default', () => {
    const h = new HeaderBag();
    expect(h.size).toBe(0);
    expect(h.has('x-test')).toBe(false);
    expect(h.get('x-test')).toBeNull();
    expect(h.getAll('x-test')).toEqual([]);
  });

  it('initializes from a plain object', () => {
    const h = new HeaderBag({ 'X-Auth': 'token', accept: 'application/json' });
    expect(h.get('x-auth')).toBe('token');
    expect(h.get('Accept')).toBe('application/json');
    expect(h.size).toBe(2);
  });

  it('handles header names case-insensitively', () => {
    const h = new HeaderBag({ 'Content-Type': 'application/json' });
    expect(h.has('CONTENT-TYPE')).toBe(true);
    expect(h.has('content-type')).toBe(true);
    expect(h.get('Content-Type')).toBe('application/json');
  });

  it('is immutable on set', () => {
    const h = new HeaderBag({ a: '1' });
    const next = h.set('b', '2');
    expect(h.has('b')).toBe(false);
    expect(next.has('b')).toBe(true);
    expect(next.get('a')).toBe('1');
  });

  it('set replaces existing values', () => {
    const h = new HeaderBag({ a: '1' }).append('a', '2');
    expect(h.getAll('a')).toEqual(['1', '2']);
    const next = h.set('a', 'x');
    expect(next.getAll('a')).toEqual(['x']);
  });

  it('append keeps multiple values', () => {
    const h = new HeaderBag({ 'set-cookie': 'a' }).append('set-cookie', 'b');
    expect(h.getAll('set-cookie')).toEqual(['a', 'b']);
  });

  it('delete removes the key', () => {
    const h = new HeaderBag({ a: '1', b: '2' });
    const next = h.delete('A');
    expect(h.has('a')).toBe(true);
    expect(next.has('a')).toBe(false);
    expect(next.has('b')).toBe(true);
  });

  it('joins multi-values in toObject', () => {
    const h = new HeaderBag({ a: '1' }).append('a', '2');
    expect(h.toObject()).toEqual({ a: '1, 2' });
  });

  it('converts to native Headers', () => {
    const h = new HeaderBag({ a: '1' }).append('a', '2');
    const headers = h.toHeaders();
    // The native Headers.get() joins multi-values with a comma+space.
    expect(headers.get('a')).toBe('1, 2');
  });

  it('absorbs a Headers instance', () => {
    const native = new Headers({ a: '1' });
    const h = new HeaderBag(native);
    expect(h.get('a')).toBe('1');
  });

  it('absorbs another HeaderBag', () => {
    const src = new HeaderBag({ a: '1', b: '2' });
    const h = new HeaderBag(src);
    expect(h.get('a')).toBe('1');
    expect(h.size).toBe(2);
  });

  it('skips null/undefined values', () => {
    const h = new HeaderBag({ a: null, b: undefined, c: 'keep' });
    expect(h.has('a')).toBe(false);
    expect(h.has('b')).toBe(false);
    expect(h.get('c')).toBe('keep');
  });

  it('exposes a shared empty instance', () => {
    expect(EMPTY_HEADERS.size).toBe(0);
    expect(EMPTY_HEADERS.has('anything')).toBe(false);
  });
});
