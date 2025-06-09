// MCP types
interface TextResponseContent {
    [x: string]: unknown;
    type: 'text';
    text: string;
}

export interface IPromptResponse {
    [x: string]: unknown;
    content: TextResponseContent[];
}

export class PromptResponse {
    constructor(content: string) {
        this.promptResponse = {
            role: 'assistant',
            content: [
                {
                    type: 'text',
                    text: content,
                }
            ]
        };
    }

    promptResponse: IPromptResponse;
}

// Tags to categorize tools
export type Tags = 'all' | 'conversation' | 'verification' | 'voice' | 'email' | 'notification' | string;
