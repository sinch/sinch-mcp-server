# LLM evals

Statistical LLM tests: each suite runs a workflow **N times** and gates on a
**pass-rate**, rather than once like the [integration
tests](../../integration/llms/README.md). Use these for **probabilistic**
behaviour — ambiguity, error-recovery, "does the model reliably do X" — where a
single pass is noise.

```bash
npm run test:eval
```

Runs the ESM Jest config and executes each eval for `EVAL_ITERATIONS`
iterations. Needs a provider API key (skips cleanly without one). This is
**not** part of `test:integration` — evals are expensive (N× the LLM calls) and
meant for nightly / pre-release, not every PR.

## Integration vs eval

|         | Integration (`test:integration`)  | Eval (`eval`)                               |
| ------- | --------------------------------- | ------------------------------------------- |
| Runs    | once                              | `EVAL_ITERATIONS` times                     |
| Gate    | pass/fail                         | `accuracy() >= passRate`                    |
| Purpose | pipeline works, tools route right | how _reliably_ the model handles hard cases |
| Cadence | every PR                          | nightly / pre-release                       |

Both reuse the same foundation — the in-process server (`utils/in-process-server.ts`)
and the jest-mocked service clients (`mocks/sinch-fakes.ts`) — so there are no
real API calls here either.

## Adding an eval (the standard)

1. Create `<name>.eval.test.ts` in this folder.
2. Declare the turns and call `defineWorkflowEval`:

   ```ts
   import { defineWorkflowEval } from './utils/workflow-eval-harness';

   defineWorkflowEval({
     name: 'RCS launch recovery',
     enforceLaunch: true, // opt-in: mock returns 412 until the sender is complete
     passRate: 0.9, // calibrate from a full-iteration run, don't guess
     steps: [
       { id: 'create', prompt: '...', accept: ['create-rcs-sender'] },
       { id: 'premature-launch', prompt: '...', responseIncludes: ['privacy'] },
       { id: 'provide-missing', prompt: '...', accept: ['update-rcs-sender'] },
       { id: 'relaunch', prompt: '...', accept: ['launch-rcs-sender'] },
     ],
   });
   ```

Step assertions (all optional, combine as needed):

- `accept` — passes if one of these tools was called.
- `expectNoTool` — passes if **no** tool was called (the model just replies).
- `allowNoTool` — with `accept`, a turn with no tool call also passes (clarify
  **or** call one of `accept`).
- `reject` — fails if any of these tools was called (ban a sibling, e.g. rent
  when search/clarify is expected).
- `responseIncludes` — the final assistant message contains each substring
  (case-insensitive). Use this for tool-aware clarification (the model asks for
  schema fields like phone/channel) or to check it _surfaced_ an unmet
  requirement rather than claiming success.

### Tool-aware clarification

Users will not know every required parameter. `expectNoTool` alone cannot tell
MCP-aware clarification from a generic chat reply. Pair it with
`responseIncludes` for missing required fields (e.g. `phone`, `number`,
`sms`/`whatsapp`), then a follow-up turn that supplies them and asserts
`accept`.

### Adding regression vs ambiguity cases

- Clear happy-paths and trickier single-turn paraphrases →
  [`fixtures/tool-cases.ts`](../../integration/llms/fixtures/tool-cases.ts)
  (integration).
- Under-specified / probabilistic clarify flows → an `*.eval.test.ts` here.
- **TDD:** fix tool `description`s when cases fail — do not rewrite prompts.
- Multi-step RCS launch/update uses **stateful** mocks (`enforceLaunch`), not
  prompt-only checks — see `rcs-launch-recovery.eval.test.ts`.

## Config

Keys: `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` (env or `.env`).

| Env var                     | Default             | Purpose                                       |
| --------------------------- | ------------------- | --------------------------------------------- |
| `EVAL_ITERATIONS`           | `30`                | Iterations per suite                          |
| `EVAL_PASS_RATE`            | `0.9`               | Default threshold (per-suite `passRate` wins) |
| `EVAL_CONCURRENCY`          | `3`                 | Parallel iterations                           |
| `WORKFLOW_MODEL`            | `openai/gpt-5-mini` | Model                                         |
| `EVAL_ITERATION_TIMEOUT_MS` | `240000`            | Per-iteration timeout                         |

## The recovery example

`rcs-launch-recovery.eval.test.ts` measures the **fail → surface → provide →
retry** loop: launch too early, the model reports the unmet requirements
(without falsely claiming success), the user supplies them, and the model
updates and relaunches. `enforceLaunch` makes the fake client reject `launch`
with a 412 until the sender is complete, so the real handler's
missing-requirements logic runs.
