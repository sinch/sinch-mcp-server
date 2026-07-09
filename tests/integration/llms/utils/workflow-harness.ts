import { HostRunner, PromptResult } from '@mcpjam/sdk';
import { registerSinchMocks } from '../mocks/sinch-fakes';
import { InProcessServer, startInProcessServer, toHostTools } from './in-process-server';
import { apiKeyFor, preflight } from './provider';

/**
 * Reusable harness for multi-turn LLM workflow evals.
 * See tests/integration/llms/README.md for the authoring standard.
 */

export interface WorkflowStep {
  /** Short id shown in the per-step log. */
  id: string;
  /** The user turn sent to the model. */
  prompt: string;
  /** Passes if ANY of these tools is called on this turn. */
  accept: string[];
}

export interface WorkflowSuiteConfig {
  name: string;
  steps: WorkflowStep[];
  model?: string;
  systemPrompt?: string;
}

const DEFAULT_MODEL = process.env.WORKFLOW_MODEL ?? process.env.TARGET_MODEL ?? 'openai/gpt-4o';
const TIMEOUT_MS = Number(process.env.WORKFLOW_TIMEOUT_MS ?? 5 * 60 * 1000);
const DEFAULT_SYSTEM_PROMPT =
  'You manage Sinch products using ONLY the provided tools. ' +
  'When the user refers to an entity by name, reuse the id returned by earlier tool calls in this conversation. ' +
  'When a request is actionable, call the appropriate tool directly instead of asking clarifying questions.';

interface StepOutcome {
  id: string;
  ok: boolean;
  called: string[];
  error?: string;
}

const evaluateStep = (step: WorkflowStep, result: PromptResult): StepOutcome => {
  const called = result.toolsCalled();
  const error = result.hasError() ? result.getError() : undefined;
  return { id: step.id, ok: !error && step.accept.some((tool) => called.includes(tool)), called, error };
};

const formatRouting = (name: string, model: string, outcomes: StepOutcome[]): string => {
  const rows = outcomes.map(
    (o) => `  ${o.ok ? '✓' : '✗'} ${o.id.padEnd(18)} [${o.called.join(', ')}]${o.error ? ` ERROR: ${o.error}` : ''}`,
  );
  return `\n${name} workflow routing (${model}):\n${rows.join('\n')}\n`;
};

const failedSteps = (outcomes: StepOutcome[]): string[] =>
  outcomes
    .filter((o) => !o.ok)
    .map((o) => `${o.id} → ${o.error ? `error: ${o.error}` : `got [${o.called.join(', ')}]`}`);

/** Register a full multi-turn workflow eval suite from a declarative config. */
export const defineWorkflowSuite = (config: WorkflowSuiteConfig): void => {
  registerSinchMocks();

  const model = config.model ?? DEFAULT_MODEL;
  const apiKey = apiKeyFor(model);

  if (!apiKey) {
    it(`skips ${config.name} workflow — no API key for ${model}`, () => {
      expect(apiKey).toBeUndefined();
    });

    return;
  }

  describe(`${config.name} workflow — ${model}`, () => {
    let server: InProcessServer;
    let agent: HostRunner;

    beforeAll(async () => {
      server = await startInProcessServer();
      agent = new HostRunner({
        tools: toHostTools(server) as never,
        model,
        apiKey,
        temperature: 0.1,
        maxSteps: 4,
        systemPrompt: config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      });
      await preflight(agent, model);
    }, 60_000);

    afterAll(async () => {
      await server?.close();
    });

    it(
      'routes every step to the expected tool',
      async () => {
        const history: PromptResult[] = [];
        const outcomes: StepOutcome[] = [];

        for (const step of config.steps) {
          const result = await agent.run(step.prompt, { context: [...history] });
          history.push(result);
          outcomes.push(evaluateStep(step, result));
        }

        console.log(formatRouting(config.name, model, outcomes));
        expect(failedSteps(outcomes)).toEqual([]);
      },
      TIMEOUT_MS,
    );
  });
};
