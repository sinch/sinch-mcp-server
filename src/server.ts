import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import ngrok from '@ngrok/ngrok';
import express from 'express';
import fs from 'fs';
import path from 'path';
import http from 'http';
import Database from 'better-sqlite3';
import { ConversationCallbackWebhooks, SinchClient } from '@sinch/sdk-core';
import { registerPrompts } from './prompts';
import { registerVerificationTools } from './tools/verification';
import { registerConversationTools } from './tools/conversation';
import { registerVoiceTools } from './tools/voice';
import { registerEmailTools } from './tools/email';
import { registerConfigurationTools } from './tools/configuration';
import { Tags } from './types';
import { version as mcpServerVersion } from '../package.json';

let webhookId: string | undefined;
let webhookPort: number | undefined;

export const instantiateMcpServer = () => {
  return new McpServer({
    name: 'Sinch',
    version: mcpServerVersion,
    capabilities: {
      resources: {},
      tools: {},
      prompts: {}
    }
  })
};

export const parseArgs = (args: string[]): Tags[] => {
  const args1 = args.slice(2);
  return args1.includes('--tags')
      ? args1[args1.indexOf('--tags') + 1].split(',')
      : [];
}

export const registerCapabilities = (server: McpServer, tags: Tags[]) => {
  if ( tags.length === 0) tags.push('all')

  // Register the prompts
  registerPrompts(server, tags);

  // Register the tools
  registerVerificationTools(server, tags);
  registerConversationTools(server, tags);
  registerVoiceTools(server, tags);
  registerEmailTools(server, tags);
  registerConfigurationTools(server);
}

export const openNgrokTunnel = async () => {
  const listener = await ngrok.forward({
    port: webhookPort,
    authtoken: process.env.NGROK_AUTH_TOKEN,
  });

  const conversationWebhookUrl = listener.url();
  if (!conversationWebhookUrl) {
    throw new Error('Failed to obtain ngrok URL');
  }

  return conversationWebhookUrl;
}

export const startWebhookListener = async () => {
  // The ngrok tunnel is for the conversation webhook only => check if the environment variables are set
  if (!process.env.CONVERSATION_PROJECT_ID
    || !process.env.CONVERSATION_KEY_ID
    || !process.env.CONVERSATION_KEY_SECRET
    || !process.env.CONVERSATION_APP_ID) return;

  // The user must have also set the NGROK_AUTH_TOKEN environment variable, and we found a port to use for the webhook events receiver
  if (!process.env.NGROK_AUTH_TOKEN || !webhookPort) return;

  let conversationWebhookUrl;
  try {
    conversationWebhookUrl = await openNgrokTunnel();
  } catch (error) {
    console.error('Failed to open ngrok tunnel:', error);
    return;
  }

  const sinchClient = new SinchClient({
    projectId: process.env.CONVERSATION_PROJECT_ID,
    keyId: process.env.CONVERSATION_KEY_ID,
    keySecret: process.env.CONVERSATION_KEY_SECRET,
  });

  let createWebhookResponse;
  try {
    createWebhookResponse= await sinchClient.conversation.webhooks.create({
      webhookCreateRequestBody: {
        app_id: process.env.CONVERSATION_APP_ID,
        target: conversationWebhookUrl,
        triggers: [
          'MESSAGE_DELIVERY', 'MESSAGE_SUBMIT'
        ],
        target_type: 'HTTP'
      }
    });
    console.info('Webhook created successfully:', createWebhookResponse.id);
  } catch (error) {
    console.error('Failed to create webhook:', error);
    return;
  }

  webhookId = createWebhookResponse.id;
  return;
}

const deleteWebhook = async (webhookId: string) => {
  const sinchClient = new SinchClient({
    projectId: process.env.CONVERSATION_PROJECT_ID,
    keyId: process.env.CONVERSATION_KEY_ID,
    keySecret: process.env.CONVERSATION_KEY_SECRET,
  });

  try {
    await sinchClient.conversation.webhooks.delete({
      webhook_id: webhookId
    });
  } catch (error) {
    console.error(`Failed to delete webhook with ID ${webhookId}:`, error);
  }
}

export const startWebhookServer = async () => {
  const app = express();
  app.use(express.json());

  const dbDir = path.join(__dirname, './data');
  const dbPath = path.join(dbDir, 'webhooks.db');

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);

  db.prepare(`
    CREATE TABLE IF NOT EXISTS webhooks_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      app_id TEXT NOT NULL,
      event_time DATETIME NOT NULL,
      message_id TEXT NOT NULL,
      channel_identity TEXT NOT NULL,
      status TEXT,
      reason TEXT,
      submitted_message TEXT
    )
  `).run();

  const insertStmt = db.prepare(`
    INSERT INTO webhooks_events (
      type, app_id, event_time, message_id, channel_identity, status, reason, submitted_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  app.post('/', (req, res) => {
    const conversationCallbackWebhook = new ConversationCallbackWebhooks('');
    const event = conversationCallbackWebhook.parseEvent(req.body);

    const appId = event.app_id;
    const eventTime = event.event_time;
    let messageId = '';
    let channelIdentity = '';
    let status = null;
    let reason = null;
    let submittedMessage = null;

    switch (event.trigger) {
      case 'MESSAGE_DELIVERY':
        messageId = event.message_delivery_report!.message_id!;
        channelIdentity = JSON.stringify(event.message_delivery_report!.channel_identity);
        status = event.message_delivery_report!.status;
        reason = JSON.stringify(event.message_delivery_report!.reason);
        break;
      case 'MESSAGE_SUBMIT':
        messageId = event.message_submit_notification!.message_id!;
        channelIdentity = JSON.stringify(event.message_submit_notification!.channel_identity);
        submittedMessage = JSON.stringify(event.message_submit_notification!.submitted_message);
        break;
      default:
        // Should never go there as we only register MESSAGE_DELIVERY and MESSAGE_SUBMIT triggers
        return;
    }

    insertStmt.run(event.trigger, appId, eventTime, messageId, channelIdentity, status, reason, submittedMessage);

    res.status(200).send();
  });

  const httpServer = http.createServer(app);

  httpServer.listen(0, async () => {
    const address = httpServer.address();
    if (typeof address === 'object' && address !== null) {
      webhookPort = address.port;
      console.info(`Webhook server listening on port ${webhookPort}`);
    }
    // Once the server is ready, create a webhook in the conversation app
    await startWebhookListener();
  });

  const shutdown = () => {
    console.info('Shutting down webhook server...');
    httpServer.close(async () => {
      console.info('HTTP server closed.');
      console.info('Deleting webhook in the conversation app...');
      if (webhookId) {
        try {
          await deleteWebhook(webhookId);
          console.info(`Webhook ${webhookId} cleanup completed.`);
        } catch (error) {
          console.error(`Webhook ${webhookId} cleanup failed:`, error);
        }
      }

      db.close();
      console.info('Database connection closed.');
      try {
        fs.unlinkSync(dbPath);
        console.info('Database file deleted.');
      } catch (err) {
        console.error('Failed to delete DB file:', (err as Error).message);
      }
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
