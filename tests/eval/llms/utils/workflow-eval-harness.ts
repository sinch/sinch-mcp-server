import { EvalTest, HostRunner, PromptResult } from '@mcpjam/sdk';
import { registerSinchMocks, withIsolatedSinchState } from '../../../integration/llms/mocks/sinch-fakes';
import { InProcessServer, startInProcessServer, toHostTools } from '../../../integration/llms/utils/in-process-server';
import { apiKeyFor, preflight } from '../../../integration/llms/utils/provider';

/**
 * Statistical multi-turn eval harness — runs a workflow N times and gates on a
 * pass-rate (unlike the integration suites, which run once as a CI gate).
 * See tests/eval/llms/README.md for the authoring standard.
 */

export interface EvalStep {
  id: string;
  prompt: string;
  /** If set, passes only if ANY of these tools is called on this turn. */
  accept?: string[];
  /** If true, passes only if NO tool is called (the model just responds). */
  expectNoTool?: boolean;
  /** Also require the final assistant message to contain each of these (case-insensitive). */
  responseIncludes?: string[];
}

export interface WorkflowEvalConfig {
  name: string;
  steps: EvalStep[];
  /** Makes the fake client reject `launch` (412) until the sender is complete. */
  enforceLaunch?: boolean;
  model?: string;
  systemPrompt?: string;
  iterations?: number;
  passRate?: number;
  concurrency?: number;
  /** Logs the raw prompt/response/messages for the first iteration only — for debugging what the model actually saw. */
  debugFirstIteration?: boolean;
}

const DEFAULT_MODEL = process.env.WORKFLOW_MODEL ?? process.env.TARGET_MODEL ?? 'openai/gpt-4o';
const ITERATIONS = Number(process.env.EVAL_ITERATIONS ?? 30);
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY ?? 3);
const PASS_RATE = Number(process.env.EVAL_PASS_RATE ?? 0.9);
const ITERATION_TIMEOUT_MS = Number(process.env.EVAL_ITERATION_TIMEOUT_MS ?? 4 * 60 * 1000);
const SUITE_TIMEOUT_MS = Number(process.env.EVAL_TIMEOUT_MS ?? 30 * 60 * 1000);

const DEFAULT_SYSTEM_PROMPT =
  'You manage Sinch products using the provided tools. Reuse ids returned by earlier tool calls. ' +
  'If an action fails or is missing prerequisites, tell the user exactly what is missing instead of claiming success.';

const finalAssistantText = (result: PromptResult): string => {
  const messages = result.getMessages();
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== 'assistant') {
      continue;
    }
    const content = message.content;
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .map((part) => (typeof part === 'string' ? part : ((part as { text?: string }).text ?? '')))
        .join(' ');
    }
  }
  return '';
};

const stepPasses = (step: EvalStep, result: PromptResult): boolean => {
  if (result.hasError()) {
    return false;
  }
  const called = result.toolsCalled();
  if (step.expectNoTool && called.length > 0) {
    return false;
  }
  if (step.accept && !step.accept.some((tool) => called.includes(tool))) {
    return false;
  }
  if (step.responseIncludes) {
    const text = finalAssistantText(result).toLowerCase();
    if (!step.responseIncludes.every((needle) => text.includes(needle.toLowerCase()))) {
      return false;
    }
  }
  return true;
};

const logStepStats = (name: string, stats: Map<string, { ok: number; total: number }>, iterations: number): void => {
  const rows = [...stats.entries()].map(
    ([id, s]) => `  ${id.padEnd(18)} ${((s.ok / s.total) * 100).toFixed(0).padStart(3)}% (${s.ok}/${s.total})`,
  );
  console.log(`\n${name} eval — per-step pass rate over ${iterations} iterations:\n${rows.join('\n')}\n`);
};

/** Register a statistical multi-turn eval suite from a declarative config. */
export const defineWorkflowEval = (config: WorkflowEvalConfig): void => {
  registerSinchMocks({ enforceLaunch: config.enforceLaunch });

  const model = config.model ?? DEFAULT_MODEL;
  const apiKey = apiKeyFor(model);
  const iterations = config.iterations ?? ITERATIONS;
  const passRate = config.passRate ?? PASS_RATE;

  if (!apiKey) {
    it(`skips ${config.name} eval — no API key for ${model}`, () => {
      expect(apiKey).toBeUndefined();
    });

    return;
  }

  describe(`${config.name} eval — ${model} (${iterations}x)`, () => {
    let server: InProcessServer;
    let agent: HostRunner;
    const stepStats = new Map<string, { ok: number; total: number }>();
    let debugLogged = !config.debugFirstIteration;

    beforeAll(async () => {
      server = await startInProcessServer();
      agent = new HostRunner({
        tools: toHostTools(server) as never,
        model,
        apiKey,
        temperature: 0.1,
        maxSteps: 6,
        systemPrompt: config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      });
      await preflight(agent, model);
    }, 60_000);

    afterAll(async () => {
      await server?.close();
    });

    it(
      `passes >= ${(passRate * 100).toFixed(0)}% of ${iterations} iterations`,
      async () => {
        const test = new EvalTest({
          name: config.name,
          // Iterations run concurrently against the same mocked module (see
          // EVAL_CONCURRENCY) — isolate each iteration's fake RCS sender store so
          // one iteration's senders can't leak into another's listSenders/getSender.
          test: (runner) =>
            withIsolatedSinchState(async () => {
              const history: PromptResult[] = [];
              let allPassed = true;
              const shouldLog = !debugLogged;
              if (shouldLog) {
                debugLogged = true;
              }
              for (const step of config.steps) {
                const result = await (runner as HostRunner).run(step.prompt, { context: [...history] });
                history.push(result);
                if (shouldLog) {
                  console.log(
                    `\n[debug] step "${step.id}"\n  prompt: ${step.prompt}\n  toolsCalled: ${JSON.stringify(result.toolsCalled())}\n  response: ${finalAssistantText(result)}\n  messages: ${JSON.stringify(result.getMessages(), null, 2)}\n`,
                  );
                }
                const ok = stepPasses(step, result);
                const stat = stepStats.get(step.id) ?? { ok: 0, total: 0 };
                stepStats.set(step.id, { ok: stat.ok + (ok ? 1 : 0), total: stat.total + 1 });
                if (!ok) {
                  allPassed = false;
                }
              }
              return allPassed;
            }),
        });

        await test.run(agent, {
          iterations,
          concurrency: config.concurrency ?? CONCURRENCY,
          timeoutMs: ITERATION_TIMEOUT_MS,
        });

        logStepStats(config.name, stepStats, iterations);
        expect(test.accuracy()).toBeGreaterThanOrEqual(passRate);
      },
      SUITE_TIMEOUT_MS,
    );
  });
};
