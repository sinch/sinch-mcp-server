import Anthropic from '@anthropic-ai/sdk';
import { listTools } from '../list-tools';
import { toolTestCases } from '../toolsTestCases';
import { MAX_TOKENS, TEMPERATURE, TIMEOUT } from '../configuration';

const transformToAnthropicFormat = (tools: any[]): Anthropic.Messages.Tool[] => {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}

describe('Tool invocation tests - Anthropic', () => {

  let tools: Anthropic.Messages.Tool[];
  let anthropic: Anthropic;

  beforeAll(async () => {
    tools = transformToAnthropicFormat(await listTools());
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  });

  it.each(toolTestCases)(
    'should handle prompt "%s"',
    async ({ prompt, expectedToolName, expectedArguments }) => {
      const response = await anthropic.messages.create({
        model: 'claude-3-7-sonnet-latest',
        max_tokens: MAX_TOKENS,
        messages: [
          {role: 'user', content: prompt}
        ],
        tools,
        temperature: TEMPERATURE,
        tool_choice: {
          type: 'auto',
        },
      });

      const toolCall = response.content.find(
        (obj) => obj.type === "tool_use"
      );

      if (!expectedToolName) {
        expect(toolCall).toBeUndefined();
        return;
      }

      expect(toolCall).toBeDefined();
      expect(toolCall!.name).toEqual(expectedToolName);

      if (expectedArguments) {
        expect(toolCall!.input).toEqual(expectedArguments);
      }
    },
    TIMEOUT
  );

});
