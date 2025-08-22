import { Client } from "@modelcontextprotocol/sdk/client/index";
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';

export const listTools = async () => {
  const client = new Client({ name: "test-client", version: "0.0.1" });
  let toolsResponse: any;
  try {
    await client.connect(new StdioClientTransport({
      command: process.execPath,
      args: ['dist/index.js'],
      env: {
        ...process.env,
        CONVERSATION_PROJECT_ID: 'test-conversation-project-id',
        CONVERSATION_KEY_ID: 'test-conversation-key-id',
        CONVERSATION_KEY_SECRET: 'test-conversation-key-secret',
        NGROK_AUTH_TOKEN: 'test-ngrok-auth-token',
        MAILGUN_API_KEY: 'test-mailgun-api-key',
        VERIFICATION_APPLICATION_KEY: 'test-verification-application-key',
        VERIFICATION_APPLICATION_SECRET: 'test-verification-application-secret',
        VOICE_APPLICATION_KEY: 'test-voice-application-key',
        VOICE_APPLICATION_SECRET: 'test-voice-application-secret',
      }
    }));

    toolsResponse = await client.request({
      method: "tools/list"
    }, z.any(), {});
  } finally {
    await client.close();
  }

  return toolsResponse.tools;
}
