import { SinchConversationCredentials, SinchVerificationCredentials } from './db-utils';


interface TextResponseContent {
    [x: string]: unknown;
    type: 'text';
    text: string;
}

export interface PromptResponse {
    [x: string]: unknown;
    content: TextResponseContent[];
}

export type SessionConversationCredentials =
    SinchConversationCredentials & { sessionId: string }
    | { sessionId: string, promptResponse: PromptResponse };

export type SessionVerificationCredentials =
    SinchVerificationCredentials & { sessionId: string }
    | { sessionId: string, promptResponse: PromptResponse };

export type MailgunCredentials = {
    domain: string;
    apiKey: string;
}

export type SessionMailgunCredentials = MailgunCredentials | { promptResponse: PromptResponse }
