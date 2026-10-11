# pico-http

A tiny, **zero-dependency**, **type-safe** HTTP client with a pluggable
interceptor pipeline, built on the native [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) API.

`pico-http` distills the interceptor-chain ideas popularized by frameworks like
Angular's `HttpClient` into a ~4 KB, framework-agnostic library you can drop
into any TypeScript or JavaScript project — browser or Node 18+.

[![npm version](https://img.shields.io/npm/v/pico-http.svg?style=flat-square)](https://www.npmjs.com/package/pico-http)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg?style=flat-square)](tsconfig.json)

---

## Features

- **Zero dependencies** — the only runtime dependency is your platform's native `fetch`.
- **Type-safe** — typed responses via generics, and a typed error hierarchy (`HttpError`, `TimeoutError`, `NetworkError`).
- **Onion-style interceptor pipeline** — one `handle()` hook observes/mutates both the request and the response, in a single, easy-to-reason-about model.
- **Fully immutable** — `Request`, `HeaderBag` and `QueryParams` never mutate; every operation returns a new instance.
- **Pluggable transport** — the default wraps `fetch`, but you can inject a mock transport to test without a network.
- **Timeout & cancellation** — per-request timeouts and external `AbortSignal`s are supported and composable.
- **Automatic body handling** — plain objects/arrays are JSON-encoded on send and JSON-decoded on receive.
- **Modern output** — ships ESM, CommonJS and IIFE builds with full type declarations.

## Install

```bash
npm install pico-http
```

Requires Node 18+ or any modern browser.

## Quick start

```ts
import { PicoClient } from 'pico-http';

interface User {
  id: number;
  name: string;
}

const client = new PicoClient({
  baseUrl: 'https://api.example.com',
  defaultHeaders: { Accept: 'application/json' },
});

// Typed response: `body` is a `User`.
const { body } = await client.get<User>('/users/1');
console.log(body.name);

// JSON is encoded automatically; `body` is inferred from the generic.
const created = await client.post<User>('/users', { name: 'pico' });
```

## Interceptors

Interceptors form an onion around the transport. Code before `await next(...)`
runs on the request path; code after it runs on the response/error path.

### Built-in interceptors

```ts
import { PicoClient, retryInterceptor, loggerInterceptor } from 'pico-http';

const client = new PicoClient({
  baseUrl: 'https://api.example.com',
  interceptors: [
    retryInterceptor({ retries: 3 }),       // exponential backoff
    loggerInterceptor(),                     // log requests, status & latency
  ],
});
```

### Writing your own

```ts
import { PicoClient, type Interceptor } from 'pico-http';

const auth: Interceptor = {
  name: 'auth',
  async handle(request, next) {
    const token = await getToken(); // your async token source
    return next(request.setHeader('Authorization', `Bearer ${token}`));
  },
};

const client = new PicoClient({ baseUrl: '...', interceptors: [auth] });
```

Because the model is an onion, a single interceptor can also read or transform
the **response**:

```ts
const timing: Interceptor = {
  name: 'timing',
  async handle(request, next) {
    const start = performance.now();
    const response = await next(request);
    console.log(`${request.method} ${request.fullUrl} — ${performance.now() - start}ms`);
    return response;
  },
};
```

## Errors

By default the client **does not throw** on non-2xx responses — you inspect
`response.ok` / `response.status`. Set `throwHttpErrors: true` to opt into
throwing `HttpError` instead.

Network-level failures always throw one of:

```ts
import { HttpError, TimeoutError, NetworkError } from 'pico-http';

try {
  await client.get('/users');
} catch (error) {
  if (error instanceof HttpError) {
    console.error('HTTP', error.status, error.url);
  } else if (error instanceof TimeoutError) {
    console.error('timed out');
  } else if (error instanceof NetworkError) {
    console.error('network unreachable');
  }
}
```

## Timeout & cancellation

```ts
// Abort after 3 seconds.
await client.get('/slow', { timeout: 3000 });

// Or cancel from the outside with an AbortSignal.
const controller = new AbortController();
const promise = client.get('/slow', { signal: controller.signal });
controller.abort(); // cancels the request
```

## Testing with a mock transport

Inject a transport to test your pipeline without any network:

```ts
import { PicoClient, Request, Response, HeaderBag } from 'pico-http';

const mock = async (request: Request) =>
  new Response({
    status: 200,
    statusText: 'OK',
    headers: new HeaderBag(),
    body: { echo: request.fullUrl },
    url: request.fullUrl,
    method: request.method,
  });

const client = new PicoClient({ transport: mock });
const { body } = await client.get('/ping');
expect(body.echo).toBe('/ping');
```

## API at a glance

| Export | Description |
| --- | --- |
| `PicoClient` | The main client; holds base URL, defaults, interceptors & transport. |
| `Request` | Immutable request description flowing through the pipeline. |
| `Response<T>` | Parsed, normalized response (`body`, `status`, `headers`, `ok`). |
| `HeaderBag` | Immutable, case-insensitive header container. |
| `QueryParams` | Immutable URL query builder with deterministic encoding. |
| `HttpError` / `TimeoutError` / `NetworkError` | Typed error hierarchy. |
| `retryInterceptor` / `loggerInterceptor` | Built-in interceptors. |
| `fetchTransport` | Default transport; swap with your own for tests. |
| `createPipeline` | Low-level composition of interceptors + a transport. |
| `Interceptor` / `NextFn` | The interceptor contract. |

## Why not just `fetch` or axios?

- **vs. `fetch`**: you get typed responses, a uniform error hierarchy, timeout
  handling, interceptors and default header/query injection — without losing
  any `fetch` capability (you can still pass `credentials`, `cache`, `redirect`,
  etc. per request).
- **vs. axios**: no Node/browser split and no dependency on the legacy
  `XMLHttpRequest`; built for `fetch` era and Promise-based code, with a smaller
  footprint and the same middleware-style composition you're used to.

## Development

```bash
npm install
npm test          # run the vitest suite
npm run build     # emit ESM / CJS / IIFE + types into dist/
npm run typecheck # strict TypeScript check
```

## License

[MIT](LICENSE) © <YOUR-NAME>
