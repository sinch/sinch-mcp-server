import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ConversationToolKey, getToolName, shouldRegisterTool } from './utils/conversation-tools-helper';
import { PromptResponse, Tags } from '../../types';
import Database from 'better-sqlite3';
import path from 'path';
import { toolsStatusMap } from '../../tools-config';

type WebhookEventRow = {
  id: number;
  type: string;
  app_id: string;
  event_time: string;
  message_id: string;
  channel_identity: string;
  status: string | null;
  reason: string | null;
  submitted_message: string | null;
};

const TOOL_KEY: ConversationToolKey = 'getMessageEvents';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerGetMessageEvents = (server: McpServer, tags: Tags[]) => {
  if (!shouldRegisterTool(TOOL_KEY, tags)) return;
  // Additional check for this tool to be able to open the ngrok tunnel
  if (!process.env.NGROK_AUTH_TOKEN) {
    toolsStatusMap[TOOL_NAME] = 'NGROK_AUTH_TOKEN environment variable is not set';
    return;
  }

  server.tool(
    TOOL_NAME,
    'Get the events of a message in a conversation. The events include delivery, read, and other status updates related to the message.',
    {
      messageId: z.string().describe('The ID of the message to get the events for'),
    },
    getMessageEventsHandler
  )
}

export const getMessageEventsHandler = async ({ messageId }: { messageId: string }) => {
  const dbPath = path.join(__dirname, '../../data/webhooks.db');
  const db = new Database(dbPath);

  const rows = db
    .prepare(`SELECT * FROM webhooks_events WHERE message_id = ? ORDER BY event_time ASC`)
    .all(messageId) as WebhookEventRow[];

  let reply = 'Here are the events for the message with ID: ' + messageId + ' to present in an array\n\n';
  rows.forEach(row  => {
    reply += `| ID: ${row.id} | Type: ${row.type} | App ID: ${row.app_id} | Event Time: ${row.event_time} | Message ID: ${row.message_id} | Channel Identity: ${row.channel_identity} | Status: ${row.status} | Reason: ${row.reason} | Submitted Message: ${row.submitted_message} |\n`;
  })

  return new PromptResponse(reply).promptResponse;
}
