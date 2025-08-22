import { FunctionCallingConfigMode, GoogleGenAI, Tool } from '@google/genai';
import { listTools } from '../list-tools';
import { toolTestCases } from '../toolsTestCases';
import { MAX_TOKENS, TEMPERATURE, TIMEOUT } from '../configuration';

const transformToGeminiFormat = (tools: any[]): Tool[] => {
  return tools.map((t) => ({
    functionDeclarations: [
      {
        name: t.name,
        description: t.description,
        parametersJsonSchema: t.inputSchema,
      }
    ]
  }));
}

describe('Tool invocation tests - Gemini', () => {

  let tools: any[];
  let gemini: GoogleGenAI;

  beforeAll(async () => {
    tools = transformToGeminiFormat(await listTools());
    gemini = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  });

  it.each(toolTestCases)(
    'should handle prompt "%s"',
    async ({ prompt, expectedToolName, expectedArguments }) => {
      const response = await gemini.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: {
          text: prompt
        },
        config: {
          maxOutputTokens: MAX_TOKENS,
          temperature: TEMPERATURE,
          tools: tools,
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.AUTO
            }
          }
        },
      });

      expect(response.candidates).toBeDefined();

      const toolCall = response.candidates
        ?.map(c => c.content?.parts?.find(p => p.functionCall)?.functionCall)
        .find(fc => fc !== undefined);

      if (!expectedToolName) {
        expect(toolCall).toBeUndefined();
        return;
      }

      expect(toolCall).toBeDefined();
      expect(toolCall!.name).toEqual(expectedToolName);

      if (expectedArguments) {
        expect(toolCall!.args).toEqual(expectedArguments);
      }
    },
    TIMEOUT
  );

});
