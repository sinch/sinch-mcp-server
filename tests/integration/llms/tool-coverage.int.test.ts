import { startInProcessServer } from './utils/in-process-server';
import { collectFixtureCoveredTools } from './fixtures/llm-tool-coverage';

/**
 * Coverage gate: every tool advertised by the live MCP server (`tools/list`
 * via the in-process client) must appear in LLM fixtures.
 *
 * Source of truth is listTools() — not hand-maintained all.json (that fixture
 * is only for tag-filtering unit tests).
 *
 * Does not need a provider API key.
 */
describe('LLM tool coverage vs tools/list', () => {
  it('covers every registered tool name in fixtures', async () => {
    const server = await startInProcessServer();
    try {
      const registered = server.tools.map((tool) => tool.name).sort();
      const covered = collectFixtureCoveredTools();
      const missing = registered.filter((name) => !covered.has(name));

      if (missing.length > 0) {
        console.log(
          `[LLM coverage] missing fixtures for:\n${missing.map((name) => `  - ${name}`).join('\n')}\n` +
            `Add a case in fixtures/tool-cases.ts (expectedToolName) or MULTI_TURN_ACCEPT_TOOLS.`,
        );
      }

      expect(missing).toEqual([]);
    } finally {
      await server.close();
    }
  });
});
