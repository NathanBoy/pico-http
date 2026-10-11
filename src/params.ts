/**
 * Immutable URL query-string builder with deterministic encoding.
 *
 * Handles string/number/boolean values, arrays (repeated keys) and nested
 * objects. Keys are percent-encoded in the order they were provided, matching
 * what most servers expect and keeping output stable for signing & caching.
 */

/** A nested query object (flattened to `key[sub]=...`). */
export interface QueryObject {
  [key: string]: QueryValue;
}

/** A single query value. Arrays expand to repeated keys; objects flatten to `key[sub]=...`. */
export type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly QueryValue[]
  | QueryObject;

/** Anything that can seed a {@link QueryParams}. */
export type QueryInput =
  | Record<string, QueryValue>
  | readonly (readonly [string, QueryValue])[]
  | URLSearchParams
  | QueryParams
  | null
  | undefined;

const HAS_OWN = Object.prototype.hasOwnProperty;

function encodeKey(key: string): string {
  return encodeURIComponent(key);
}

function encodeValue(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  return encodeURIComponent(String(value));
}

function flatten(
  key: string,
  value: QueryValue,
  out: [string, string][],
): void {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    for (const item of value) flatten(key, item, out);
    return;
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value as unknown as Record<string, QueryValue>)) {
      flatten(`${key}[${k}]`, v, out);
    }
    return;
  }
  const encoded = encodeValue(value);
  if (encoded !== undefined) out.push([encodeKey(key), encoded]);
}

export class QueryParams {
  /** Ordered list of encoded `[key, value]` pairs. */
  private readonly entries: [string, string][];

  constructor(input: QueryInput = null) {
    this.entries = [];
    if (!input) return;
    if (input instanceof QueryParams) {
      this.entries = input.entries.map((e) => [...e] as [string, string]);
      return;
    }
    if (input instanceof URLSearchParams) {
      input.forEach((value, key) => this.entries.push([encodeKey(key), encodeValue(value)!]));
      return;
    }
    if (Array.isArray(input)) {
      for (const [key, value] of input) flatten(key, value, this.entries);
      return;
    }
    if (isRecord(input)) {
      for (const key of Object.keys(input)) {
        if (!HAS_OWN.call(input, key)) continue;
        flatten(key, input[key]!, this.entries);
      }
    }
  }

  /**
   * Returns a copy with the given key appended (repeated keys are kept).
   */
  append(key: string, value: QueryValue): QueryParams {
    const copy = new QueryParams();
    copy.entries.push(...this.entries.map((e) => [...e] as [string, string]));
    flatten(key, value, copy.entries);
    return copy;
  }

  /**
   * Returns a copy with the given key set, removing any existing occurrences.
   */
  set(key: string, value: QueryValue): QueryParams {
    const encoded = encodeKey(key);
    const kept = this.entries.filter(([k]) => k !== encoded);
    const copy = new QueryParams();
    copy.entries.push(...kept);
    flatten(key, value, copy.entries);
    return copy;
  }

  /**
   * Returns a copy without the given key.
   */
  delete(key: string): QueryParams {
    const encoded = encodeKey(key);
    const copy = new QueryParams();
    copy.entries.push(...this.entries.filter(([k]) => k !== encoded));
    return copy;
  }

  /**
   * Whether the given key is present.
   */
  has(key: string): boolean {
    const encoded = encodeKey(key);
    return this.entries.some(([k]) => k === encoded);
  }

  /**
   * First value for the key, or `null`.
   */
  get(key: string): string | null {
    const encoded = encodeKey(key);
    const hit = this.entries.find(([k]) => k === encoded);
    return hit ? hit[1] : null;
  }

  /**
   * All values for the key (possibly empty).
   */
  getAll(key: string): string[] {
    const encoded = encodeKey(key);
    return this.entries.filter(([k]) => k === encoded).map(([, v]) => v);
  }

  /**
   * All distinct keys (decoded), in first-occurrence order. Useful for
   * merge/overlay logic that needs to know which keys are present.
   */
  keys(): string[] {
    const seen = new Set<string>();
    const keys: string[] = [];
    for (const [k] of this.entries) {
      const decoded = safeDecode(k);
      if (!seen.has(decoded)) {
        seen.add(decoded);
        keys.push(decoded);
      }
    }
    return keys;
  }

  /**
   * All `[key, value]` pairs with decoded keys and values, in order.
   */
  toRawEntries(): [string, string][] {
    return this.entries.map(([k, v]) => [safeDecode(k), safeDecode(v)] as [string, string]);
  }

  /**
   * Serialized query string without the leading `?`.
   */
  toString(): string {
    return this.entries.map(([k, v]) => `${k}=${v}`).join('&');
  }

  /**
   * Native `URLSearchParams` representation.
   */
  toURLSearchParams(): URLSearchParams {
    const sp = new URLSearchParams();
    for (const [k, v] of this.entries) sp.append(k, v);
    return sp;
  }

  get size(): number {
    return this.entries.length;
  }
}

/** Empty shared instance, safe to reuse since `QueryParams` is immutable. */
export const EMPTY_PARAMS = new QueryParams();

function safeDecode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

function isRecord(value: unknown): value is Record<string, QueryValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
