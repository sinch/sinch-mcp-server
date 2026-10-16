// MCP types
interface TextResponseContent {
  [x: string]: unknown;
  type: 'text';
  text: string;
}

export interface IPromptResponse {
  [x: string]: unknown;
  content: TextResponseContent[];
  isError?: boolean;
}

export class PromptResponse {
  constructor(content: string, options?: { isError?: boolean }) {
    this.promptResponse = {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: content,
        },
      ],
      ...(options?.isError && { isError: true }),
    };
  }

  promptResponse: IPromptResponse;
}

// Tags to categorize tools
export type Tags = 'all' | 'conversation' | 'verification' | 'voice' | 'email' | 'notification' | string;

export interface ToolsConfig {
  name: string;
  tags: Tags[];
}
