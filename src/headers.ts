/**
 * A lightweight, immutable header container.
 *
 * Header names are treated case-insensitively (as the HTTP spec requires), and
 * are always stored lowercase internally. Every mutating operation returns a
 * *new* instance, so instances can be shared freely without aliasing bugs.
 *
 * @packageDocumentation
 */

/** Anything that can be used to initialize a {@link HeaderBag}. */
export type HeaderInput =
  | Record<string, string | readonly string[] | undefined | null>
  | readonly (readonly [string, string])[]
  | Headers
  | HeaderBag
  | null
  | undefined;

function normalizeRecord(
  input: Record<string, string | readonly string[] | undefined | null>,
): [string, string][] {
  const entries: [string, string][] = [];
  for (const [name, value] of Object.entries(input)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const v of value) entries.push([name, String(v)]);
    } else {
      entries.push([name, String(value)]);
    }
  }
  return entries;
}

export class HeaderBag {
  /** Lowercased header name -> values, in insertion order. */
  private readonly store: Map<string, string[]>;

  constructor(input: HeaderInput = null) {
    this.store = new Map();
    if (!input) return;
    this.#absorb(input);
  }

  #absorb(input: NonNullable<HeaderInput>): void {
    if (input instanceof HeaderBag) {
      for (const [name, values] of input.store) {
        this.store.set(name, [...values]);
      }
      return;
    }
    if (input instanceof Headers) {
      input.forEach((value, name) => this.#addRaw(name, value));
      return;
    }
    if (Array.isArray(input)) {
      for (const [name, value] of input) this.#addRaw(name, value);
      return;
    }
    for (const [name, value] of normalizeRecord(
      input as Record<string, string | readonly string[] | undefined | null>,
    )) {
      this.#addRaw(name, value);
    }
  }

  /** Appends a value in place (constructor-internal only). */
  #addRaw(name: string, value: string): void {
    const key = name.toLowerCase();
    const existing = this.store.get(key) ?? [];
    this.store.set(key, existing.concat([value]));
  }

  /**
   * Returns `true` when the given header name is present, regardless of value.
   */
  has(name: string): boolean {
    return this.store.has(name.toLowerCase());
  }

  /**
   * Returns the first value of the header, or `null` when absent.
   */
  get(name: string): string | null {
    const values = this.store.get(name.toLowerCase());
    return values && values.length > 0 ? values[0]! : null;
  }

  /**
   * Returns all values of the header as an array (possibly empty).
   */
  getAll(name: string): string[] {
    const values = this.store.get(name.toLowerCase());
    return values ? [...values] : [];
  }

  /**
   * Returns a copy with the header set to a single value, replacing any existing ones.
   */
  set(name: string, value: string | readonly string[]): HeaderBag {
    const copy = this.#clone();
    copy.store.set(name.toLowerCase(), Array.isArray(value) ? value.map(String) : [String(value)]);
    return copy;
  }

  /**
   * Returns a copy with the value appended to the header's existing values.
   */
  append(name: string, value: string | readonly string[]): HeaderBag {
    const copy = this.#clone();
    const key = name.toLowerCase();
    const existing = copy.store.get(key) ?? [];
    copy.store.set(
      key,
      existing.concat(Array.isArray(value) ? value.map(String) : [String(value)]),
    );
    return copy;
  }

  /**
   * Returns a copy with the header removed entirely.
   */
  delete(name: string): HeaderBag {
    const copy = this.#clone();
    copy.store.delete(name.toLowerCase());
    return copy;
  }

  /**
   * All header names currently stored, in insertion order.
   */
  keys(): string[] {
    return [...this.store.keys()];
  }

  /**
   * The total number of distinct header names.
   */
  get size(): number {
    return this.store.size;
  }

  /**
   * Plain-object representation. When a header has multiple values, they are
   * joined with `, ` (the standard multi-value header joining convention).
   */
  toObject(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [name, values] of this.store) {
      out[name] = values.join(', ');
    }
    return out;
  }

  /**
   * A native `Headers` instance built from this bag. Useful when handing off
   * to the `fetch` API.
   */
  toHeaders(): Headers {
    const headers = new Headers();
    for (const [name, values] of this.store) {
      for (const value of values) headers.append(name, value);
    }
    return headers;
  }

  #clone(): HeaderBag {
    const copy = new HeaderBag();
    for (const [name, values] of this.store) copy.store.set(name, [...values]);
    return copy;
  }
}

/** Empty shared instance, safe to reuse since `HeaderBag` is immutable. */
export const EMPTY_HEADERS = new HeaderBag();
