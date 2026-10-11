# Contributing to pico-http

Thanks for taking the time to contribute! This guide explains how to set up the
project, run checks, and submit a change that can be merged smoothly.

## Getting started

```bash
git clone https://github.com/NathanBoy/pico-http.git
cd pico-http
npm install
```

## Development commands

| Command                  | What it does                                    |
| ------------------------ | ----------------------------------------------- |
| `npm test`               | Run the vitest suite once                       |
| `npm run test:watch`     | Run tests in watch mode                         |
| `npm run typecheck`      | Strict TypeScript type check                    |
| `npm run test:coverage`  | Run tests with a v8 coverage report             |
| `npm run lint`           | ESLint over `src/` and `test/`                  |
| `npm run lint:fix`       | Auto-fix lint issues                            |
| `npm run format`         | Format everything with Prettier                 |
| `npm run format:check`   | Verify formatting (no writes)                   |
| `npm run build`          | Emit ESM / CJS / IIFE + types into `dist/`      |
| `node examples/demo.mjs` | Run the usage demo (local server, offline-safe) |

Run the full local suite before submitting a PR:

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
```

Coverage is enforced in CI with thresholds of 85% lines/statements, 90%
functions and 80% branches. To review the report locally:

```bash
npm run test:coverage
```

## Commit conventions

Use [Conventional Commits](https://www.conventionalcommits.org/) so the changelog
and history stay readable:

```
feat: add a new interceptor
fix: handle empty JSON responses
docs: improve README usage example
refactor: extract body encoding into a helper
test: cover header merge ordering
```

## Submitting a pull request

1. **Fork** the repository and create a branch off `main`
   (`git checkout -b feat/my-change`).
2. Make your change, add or update **tests** for it.
3. Run the full local suite above and make sure it's green.
4. Keep the change focused; one logical change per PR.
5. Open the PR against `main` with a clear description. CI runs
   typecheck + lint + format check + tests + build on Node 18/20/22.

## Reporting issues

Open a [GitHub issue](https://github.com/NathanBoy/pico-http/issues) with:

- the pico-http version (commit or tag) you're using,
- a minimal reproduction (a script or a failing test is ideal),
- expected vs. actual behaviour.

## License

By contributing you agree that your contributions are licensed under the
[MIT License](LICENSE).
