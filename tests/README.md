# Tests

Three layers:

- **Unit tests** (this directory) — fast, no network, no LLM. Verify individual
  tool handlers and helpers in isolation. Run with `npm test`.
- **LLM integration tests** ([`integration/llms`](integration/llms/README.md)) —
  drive the real MCP server with a real LLM to check tool routing (single pass,
  CI gate). Run with `npm run test:integration`.
- **LLM evals** ([`eval/llms`](eval/llms/README.md)) — the same, but run many
  iterations and gate on a pass-rate, for probabilistic behaviour like
  error-recovery. Run with `npm run test:eval`.

## Unit tests

```bash
npm test
```

Runs Jest ([`jest.config.ts`](../jest.config.ts), ts-jest / CommonJS) over
`tests/**/*.test.ts`, excluding `tests/integration/`.

### Layout

Tests mirror `src/`:

```
tests/
├── tools/<domain>/<tool>.test.ts         a tool handler (e.g. tools/rcs/rcs-handlers.test.ts)
├── tools/<domain>/utils/<helper>.test.ts a helper/formatter
├── server.test.ts                        tool registration & --tags filtering
├── utils.test.ts                         shared utilities
├── setup/env.mock.ts                     global env mock (setupFiles)
├── helpers/mock-env.ts                   populate the mocked env per test
└── fixtures/                             static expectations (e.g. server tag-filtering)
```

### Conventions

- **Test the unit directly** — import the handler/helper from `src/` and call
  it; assert on the returned `PromptResponse` / value. No MCP server is spawned.
- **Env is mocked globally.** [`setup/env.mock.ts`](setup/env.mock.ts) replaces
  `src/env` with [`src/__mocks__/env.ts`](../src/__mocks__/env.ts) (an empty
  `mockEnv`). A test that needs credentials sets them via
  [`helpers/mock-env.ts`](helpers/mock-env.ts) and calls `resetMockEnv()`
  between tests. So handlers read a controllable env, never the real `.env`.
- **Mock the service, not HTTP.** To keep a handler off the network, `jest.mock`
  its `*-service-helper` and return a fake client:

  ```ts
  jest.mock('../../../src/tools/rcs/utils/rcs-service-helper');
  const mockClient = { createSender: jest.fn() /* … */ };
  (getRcsProvisioningClient as jest.Mock).mockReturnValue(mockClient);
  ```

  The real handler, argument handling and response formatting still run — only
  the API client is faked. The LLM workflow tests mock the **same boundary**
  (they run the server in-process and `jest.unstable_mockModule` the service
  helpers) — see the integration README.

- **Fixtures** hold static expectations; e.g. `fixtures/server/tag-filtering/`
  maps each `--tags` value to the tools that should be registered.
- [`jest-extended`](https://jest-extended.jestjs.io/) matchers are available
  (e.g. `toBeTrue()`).

## LLM integration tests

See [`integration/llms/README.md`](integration/llms/README.md) for the mcp-jam
suites, the no-real-API approach, and how to add a workflow.
