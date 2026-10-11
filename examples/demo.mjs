/**
 * pico-http usage demo.
 *
 * Run it after building (it imports from `dist`):
 *
 *   npm run build
 *   node examples/demo.mjs
 *
 * It starts a tiny local HTTP server so it works offline and reliably.
 */

import http from 'node:http';
import {
  PicoClient,
  retryInterceptor,
  loggerInterceptor,
  HeaderBag,
  Response,
  HttpError,
  TimeoutError,
  NetworkError,
} from '../dist/index.js';

// ---------------------------------------------------------------------------
// 1. A tiny local server to talk to.
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/users')) {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ id: 1, name: 'pico' }));
  } else if (req.url.startsWith('/create')) {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ created: JSON.parse(raw || '{}') }));
    });
  } else if (req.url.startsWith('/boom')) {
    res.statusCode = 503;
    res.end('temporarily unavailable');
  } else if (req.url.startsWith('/slow')) {
    setTimeout(() => {
      res.end('late');
    }, 3000);
  } else {
    res.statusCode = 404;
    res.end('not found');
  }
});

await new Promise((resolve) => server.listen(0, resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

// ---------------------------------------------------------------------------
// 2. A client with retry + logging.
// ---------------------------------------------------------------------------
const client = new PicoClient({
  baseUrl,
  throwHttpErrors: false, // inspect response.ok instead of throwing by default
  interceptors: [
    retryInterceptor({ retries: 2, delay: 50 }),
    loggerInterceptor(),
  ],
});

// ---------------------------------------------------------------------------
// 3. Typed GET.
// ---------------------------------------------------------------------------
const user = await client.get('/users');
console.log('\nGET /users   ->', JSON.stringify(user.body), '| status', user.status);

// ---------------------------------------------------------------------------
// 4. Typed POST with automatic JSON encoding.
// ---------------------------------------------------------------------------
const created = await client.post('/create', { name: 'NathonBoy' });
console.log('POST /create ->', JSON.stringify(created.body));

// ---------------------------------------------------------------------------
// 5. Error handling (non-2xx does not throw by default).
// ---------------------------------------------------------------------------
const boom = await client.get('/boom');
console.log('GET /boom    -> status', boom.status, '| ok', boom.ok, '| body', boom.body);

// ---------------------------------------------------------------------------
// 6. A client that throws on non-2xx + typed errors.
// ---------------------------------------------------------------------------
const strict = new PicoClient({ baseUrl, throwHttpErrors: true });
try {
  await strict.get('/boom');
} catch (error) {
  if (error instanceof HttpError) {
    console.log('strict client -> HttpError, status =', error.status);
  } else if (error instanceof TimeoutError) {
    console.log('strict client -> TimeoutError');
  } else if (error instanceof NetworkError) {
    console.log('strict client -> NetworkError');
  }
}

// ---------------------------------------------------------------------------
// 7. Timeout. (A separate client without retry, so the demo is clean.)
// ---------------------------------------------------------------------------
const timedOut = new PicoClient({ baseUrl, interceptors: [loggerInterceptor()] });
try {
  await timedOut.get('/slow', { timeout: 500 });
} catch (error) {
  if (error instanceof TimeoutError) {
    console.log('GET /slow    -> TimeoutError after 500ms');
  } else {
    console.log('GET /slow    -> unexpected error', error);
  }
}

// ---------------------------------------------------------------------------
// 8. Custom auth interceptor + per-request signal (cancellation).
// ---------------------------------------------------------------------------
const authed = new PicoClient({
  baseUrl,
  interceptors: [
    {
      name: 'auth',
      async handle(request, next) {
        return next(request.setHeader('Authorization', 'Bearer demo-token'));
      },
    },
  ],
});
const withAuth = await authed.get('/users');
console.log('auth client  ->', JSON.stringify(withAuth.body));

// ---------------------------------------------------------------------------
// 9. Testing without a network: inject a mock transport.
// ---------------------------------------------------------------------------
const mock = async (request) =>
  new Response({
    status: 200,
    statusText: 'OK',
    headers: new HeaderBag(),
    body: { echo: request.fullUrl },
    url: request.fullUrl,
    method: request.method,
  });
const offline = new PicoClient({ transport: mock });
const pong = await offline.get('/ping?x=1');
console.log('mock client  ->', JSON.stringify(pong.body));

server.close();
console.log('\nAll demo steps ran successfully.');
