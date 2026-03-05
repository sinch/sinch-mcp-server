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
        PROJECT_ID: 'test-project-id',
        KEY_ID: 'test-key-id',
        KEY_SECRET: 'test-key-secret',
        MAILGUN_API_KEY: 'test-mailgun-api-key',
        APPLICATION_KEY: 'test-application-key',
        APPLICATION_SECRET: 'test-application-secret',
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
