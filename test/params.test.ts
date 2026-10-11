import { describe, it, expect } from 'vitest';
import { QueryParams, EMPTY_PARAMS } from '../src/index.js';

describe('QueryParams', () => {
  it('is empty by default', () => {
    const p = new QueryParams();
    expect(p.toString()).toBe('');
    expect(p.size).toBe(0);
  });

  it('serializes simple key/value pairs', () => {
    const p = new QueryParams({ a: '1', b: '2' });
    expect(p.toString()).toBe('a=1&b=2');
  });

  it('expands arrays into repeated keys', () => {
    const p = new QueryParams({ tag: ['x', 'y'] });
    expect(p.toString()).toBe('tag=x&tag=y');
  });

  it('skips null and undefined values', () => {
    const p = new QueryParams({ a: null, b: undefined, c: 'keep' });
    expect(p.toString()).toBe('c=keep');
  });

  it('encodes special characters in keys and values', () => {
    const p = new QueryParams({ 'q a': 'x&y=z', emoji: '😀' });
    expect(p.toString()).toBe('q%20a=x%26y%3Dz&emoji=%F0%9F%98%80');
  });

  it('flattens nested objects with bracket keys', () => {
    const p = new QueryParams({ filter: { limit: '10', sort: 'asc' } });
    expect(p.toString()).toBe('filter%5Blimit%5D=10&filter%5Bsort%5D=asc');
  });

  it('append keeps repeated keys and is immutable', () => {
    const p = new QueryParams({ a: '1' });
    const next = p.append('a', '2');
    expect(p.toString()).toBe('a=1');
    expect(next.toString()).toBe('a=1&a=2');
  });

  it('set replaces existing occurrences', () => {
    const p = new QueryParams({ a: '1' }).append('a', '2');
    const next = p.set('a', 'x');
    expect(next.toString()).toBe('a=x');
  });

  it('delete removes all occurrences', () => {
    const p = new QueryParams({ a: '1' }).append('a', '2').append('b', '3');
    const next = p.delete('a');
    expect(next.toString()).toBe('b=3');
  });

  it('has/get/getAll behave correctly', () => {
    const p = new QueryParams({ a: '1' }).append('a', '2').append('b', '3');
    expect(p.has('a')).toBe(true);
    expect(p.has('zzz')).toBe(false);
    expect(p.get('a')).toBe('1');
    expect(p.getAll('a')).toEqual(['1', '2']);
    expect(p.get('b')).toBe('3');
  });

  it('reports distinct keys', () => {
    const p = new QueryParams({ a: '1' }).append('a', '2').append('b', '3');
    expect(p.keys()).toEqual(['a', 'b']);
  });

  it('exposes raw entries with decoded values', () => {
    const p = new QueryParams({ 'a b': '1 2' });
    expect(p.toRawEntries()).toEqual([['a b', '1 2']]);
  });

  it('converts to URLSearchParams', () => {
    const p = new QueryParams({ a: '1', b: '2' });
    const sp = p.toURLSearchParams();
    expect(sp.get('a')).toBe('1');
    expect(sp.get('b')).toBe('2');
  });

  it('exposes a shared empty instance', () => {
    expect(EMPTY_PARAMS.toString()).toBe('');
  });
});
