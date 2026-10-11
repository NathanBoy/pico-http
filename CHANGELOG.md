# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- `fetchTransport`: requests that combine an external `AbortSignal` with a
  `timeout` no longer fail on Node < 20.3, where `AbortSignal.any` is
  unavailable (a manual signal-combining fallback is used instead).

## [0.1.0] - 2026-10-11

### Added

- `PicoClient` with `request`/`get`/`post`/`put`/`patch`/`delete`/`head`/`options` helpers.
- Immutable `Request`, `HeaderBag` and `QueryParams` value objects.
- Onion-style interceptor pipeline (`Interceptor` / `NextFn` / `createPipeline`).
- Built-in `retryInterceptor` (exponential backoff) and `loggerInterceptor`.
- Pluggable transport with a default `fetchTransport` (JSON encode/decode, timeout, abort).
- Typed error hierarchy: `HttpError`, `TimeoutError`, `NetworkError`, `RequestError`.
- `throwHttpErrors` opt-in, plus a `defaultTimeout` and default header/query injection.
- ESM, CommonJS and IIFE builds with full TypeScript declarations.
- Vitest test suite (70 tests).
