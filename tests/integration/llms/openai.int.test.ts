import OpenAI from "openai";
import { Tool } from 'openai/resources/responses/responses';
import { toolTestCases } from '../toolsTestCases';
import { listTools } from '../list-tools';
import { MAX_TOKENS, TEMPERATURE, TIMEOUT } from '../configuration';

const transformToOpenAIFormat = (tools: any[]): Tool[] => {
  return tools.map((t) => ({
    type: 'function',
    name: t.name,
    description: t.description,
    parameters: JSON.stringify(t.inputSchema) === JSON.stringify({ type: "object" }) ? null : t.inputSchema,
    strict: false,
  }));
}

describe('Tool invocation tests - Open AI', () => {

  let tools: Tool[];
  let openai: OpenAI;

  beforeAll(async () => {
    tools = transformToOpenAIFormat(await listTools());
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  });

  it.each(toolTestCases)(
    'should handle prompt "%s"',
    async ({ prompt, expectedToolName, expectedArguments }) => {
      const response = await openai.responses.create({
        model: 'gpt-4o-mini',
        temperature: TEMPERATURE,
        max_output_tokens: MAX_TOKENS,
        input: prompt,
        tools,
        tool_choice: 'auto',
      });

      const toolCall = response.output.find(
        (obj) => obj.type === "function_call"
      );

      if (!expectedToolName) {
        expect(toolCall).toBeUndefined();
        return;
      }

      expect(toolCall).toBeDefined();
      expect(toolCall!.name).toEqual(expectedToolName);

      if (expectedArguments) {
        expect(toolCall!.arguments).toEqual(JSON.stringify(expectedArguments));
      }
    },
    TIMEOUT
  );

});
