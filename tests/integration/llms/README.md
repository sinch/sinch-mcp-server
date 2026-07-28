# LLM integration tests

These suites test how an LLM actually drives the MCP tools — the layer above the
unit tests, where the model decides _which_ tool to call and _with what
arguments_. They use [`@mcpjam/sdk`](https://docs.mcpjam.com/sdk) to run a real
agentic loop against a real instance of our MCP server.

Run them with:

```bash
npm run test:integration
```

Runs Jest in ESM mode (required — `@mcpjam/sdk` is pure ESM). A provider API key
is needed (see [Configuration](#configuration)); with no key the suites skip
cleanly.

## No real API calls

The MCP server runs **in-process** (built with `instantiateMcpServer()` and
connected over an in-memory transport — see [`utils/in-process-server.ts`](utils/in-process-server.ts)),
and the **real tool handlers execute**. We mock the **service clients** with
`jest.unstable_mockModule` — the same boundary the unit tests use — so the
handler, argument parsing, and response formatting all run, but no HTTP is ever
issued. See [`mocks/sinch-fakes.ts`](mocks/sinch-fakes.ts).

Because the server is in-process, `jest.mock` reaches it directly — no child
process, no network interception. We mock the client, not the tool call, so the
handler pipeline (the thing these tests exist to exercise) runs for real.

`tool-invocation` is the exception: it's single-turn selection, so it uses the
real tool _definitions_ but stubs execution (the result is irrelevant when there
is no next turn), needing no service mocks at all.

## Layout

```
tests/integration/llms/
├── tool-coverage.int.test.ts             every tools/list name appears in LLM fixtures
├── tool-invocation.int.test.ts          single-turn tool-selection matrix (all providers)
├── rcs-onboarding-workflow.int.test.ts   multi-turn workflow (just declares its steps)
├── utils/
│   ├── workflow-harness.ts               defineWorkflowSuite — the multi-turn harness
│   ├── in-process-server.ts              build + connect the real server in-process
│   └── provider.ts                       apiKeyFor, preflight, key loading
├── mocks/
│   └── sinch-fakes.ts                    registerSinchMocks — jest-mocked service clients
└── fixtures/
    ├── tool-cases.ts                     single-turn prompt → expected tool/args data
    ├── llm-tool-coverage.ts              collect covered tool names for the gate
    └── config.ts                         TEMPERATURE / TIMEOUT
```

Folder = role: **tests** at the top level, **utils/** reusable machinery,
**mocks/** the fake service clients, **fixtures/** static data.

## Coverage gate (`tools/list`)

[`tool-coverage.int.test.ts`](tool-coverage.int.test.ts) starts the in-process
server, reads the live tool names from `client.listTools()`, and asserts each
name appears in LLM fixtures (`expectedToolName` / `accept` in
[`fixtures/tool-cases.ts`](fixtures/tool-cases.ts), plus
`MULTI_TURN_ACCEPT_TOOLS` for workflow/eval-only tools).

**Do not** use `tests/fixtures/server/tag-filtering/all.json` for this — that
file is hand-maintained for tag-filtering unit tests only.

No provider API key is required for the coverage gate.

## Regression vs ambiguity (single-turn)

Both live primarily in [`fixtures/tool-cases.ts`](fixtures/tool-cases.ts):

- **Regression** — clear happy-path prompts that already include required args;
  assert tool name (+ partial args).
- **Ambiguity** — trickier paraphrases (e.g. “area code 415”, “San Francisco
  number for SMS”) that must still route to the correct sibling tool. Prefer
  adding these next to the happy-path case. Promote flaky cases to
  [`tests/eval/llms`](../../eval/llms/README.md).

**TDD rule:** if routing fails, rewrite the tool `description` (and schema
`.describe()` text) — do **not** soften the prompt.

## Two kinds of test

- **`tool-invocation.int.test.ts`** — single-turn _selection_. Each case is one
  prompt; we assert the model routes to the expected tool (and, when given,
  matching arguments) across every provider that has a key. Tool execution is
  stubbed here (single turn, so the result is irrelevant), which keeps it fast
  and provider-agnostic.
- **`*-workflow.int.test.ts`** — multi-turn. A realistic conversation where each
  turn depends on the previous one. Tool execution is **real** (against
  jest-mocked service clients), and mcp-jam's `context` threads the full history
  — including real tool results like a created entity's id — into each
  subsequent turn. That id threading is what lets e.g. "launch the sender"
  resolve to the sender created earlier.

## Adding a workflow (the standard)

1. Create `<name>-workflow.int.test.ts` in this folder.
2. Declare the conversation as ordered steps and call `defineWorkflowSuite`:

   ```ts
   import { defineWorkflowSuite } from './utils/workflow-harness';

   defineWorkflowSuite({
     name: 'Conversation app setup',
     steps: [
       { id: 'create-app', prompt: '...', accept: ['create-conversation-app'] },
       { id: 'add-sms', prompt: '...', accept: ['set-sms-channel-on-app'] },
       // ...
     ],
   });
   ```

   - `prompt` — the user turn. Provide required parameters so the eval measures
     _routing_, not the model's clarifying-question behaviour.
   - `accept` — tool name(s) that count as correct for that turn (list more than
     one when there's a legitimate alternative).

3. **No per-workflow mock.** One shared fake (`registerSinchMocks`, wired in by
   the harness) serves every workflow. Only if a workflow calls a tool backed by
   a service that isn't faked yet, add it to
   [`mocks/sinch-fakes.ts`](mocks/sinch-fakes.ts) — a whole-module mock must
   mirror _every_ export of the real service helper.

The harness owns everything else: building the in-process server, wiring the
fakes, building the `HostRunner`, a provider preflight (one cheap call that fails
loudly if the key/credits/model are unusable), context threading, per-step
routing logs, the assertion, a clean skip when no key is set, and teardown.

## Configuration

Provider keys are read from the environment or `.env`:
`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`.

| Env var                                             | Default               | Purpose                                          |
| --------------------------------------------------- | --------------------- | ------------------------------------------------ |
| `WORKFLOW_MODEL`                                    | `openai/gpt-5-mini`   | Model for the workflow suites (`provider/model`) |
| `ANTHROPIC_MODEL` / `OPENAI_MODEL` / `GEMINI_MODEL` | per-provider defaults | Model per provider in the single-turn matrix     |
| `WORKFLOW_TIMEOUT_MS`                               | `300000`              | Per-workflow timeout (a full run is ~30–90s)     |

Each run is currently a **single pass** (one attempt), not a statistical
pass-rate over N iterations.
