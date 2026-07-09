import { HostRunner, matchToolCallWithArgs } from '@mcpjam/sdk';
import { toolTestCases } from './fixtures/tool-cases';
import { TEMPERATURE, TIMEOUT } from './fixtures/config';
import { InProcessServer, startInProcessServer } from './utils/in-process-server';
import { apiKeyFor, preflight } from './utils/provider';

// One matrix over every provider. This is a single-turn *selection* test, so we
// use the real tool definitions (from the in-process server) but STUB execution
// — there's no cross-turn threading, so the tool result is irrelevant, and
// stubbing means no service mocks and no real API calls.
const STUB_TOOL_RESULT = { content: [{ type: 'text', text: JSON.stringify({ success: true, stubbed: true }) }] };

interface Provider {
  name: string;
  model: string;
  apiKey: string;
}

const PROVIDERS: Provider[] = [
  { name: 'Anthropic', model: process.env.ANTHROPIC_MODEL ?? 'anthropic/claude-3-7-sonnet-latest' },
  { name: 'OpenAI', model: process.env.OPENAI_MODEL ?? 'openai/gpt-4o-mini' },
  { name: 'Gemini', model: process.env.GEMINI_MODEL ?? 'google/gemini-2.0-flash' },
]
  .map((p) => ({ ...p, apiKey: apiKeyFor(p.model) }))
  .filter((p): p is Provider => Boolean(p.apiKey));

// An empty matrix is a Jest error, so register a placeholder when no key is set.
if (PROVIDERS.length === 0) {
  it('skips — no provider API key (ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY)', () => {
    expect(PROVIDERS).toHaveLength(0);
  });
}

describe.each(PROVIDERS)('Tool invocation — $name ($model)', ({ model, apiKey }: Provider) => {
  let server: InProcessServer;
  let agent: HostRunner;

  beforeAll(async () => {
    server = await startInProcessServer();
    const tools = server.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      execute: async () => STUB_TOOL_RESULT,
    }));
    agent = new HostRunner({ tools: tools as never, model, apiKey, temperature: TEMPERATURE, maxSteps: 1 });
    await preflight(agent, model);
  }, 60_000);

  afterAll(async () => {
    await server?.close();
  });

  it.each(toolTestCases)(
    'handles "$prompt"',
    async ({ prompt, expectedToolName, expectedArguments, accept }) => {
      const result = await agent.run(prompt);
      if (result.hasError()) {
        throw new Error(`${model} run failed: ${result.getError()}`);
      }

      const acceptedTools = accept ?? (expectedToolName ? [expectedToolName] : []);
      if (acceptedTools.length === 0) {
        expect(result.toolsCalled()).toHaveLength(0);
        return;
      }
      expect(acceptedTools.some((tool) => result.hasToolCall(tool))).toBeTrue();

      if (expectedToolName && expectedArguments) {
        expect(matchToolCallWithArgs(expectedToolName, expectedArguments, result.getToolCalls())).toBeTrue();
      }
    },
    TIMEOUT,
  );
});
