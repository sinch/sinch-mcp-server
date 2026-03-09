import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Conversation } from '@sinch/sdk-core';
import { z } from 'zod';
import { Recipient, ConversationAppIdOverride, ConversationChannel, ConversationRegionOverride, MessageSenderNumberOverride } from './prompt-schemas';
import {
  getConversationAppId,
  getConversationClient,
  setConversationRegion,
} from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { buildMessageBase } from './utils/send-message-builder';
import { IPromptResponse, PromptResponse, Tags } from '../../types';

const TOOL_KEY: ConversationToolKey = 'sendMediaMessage';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerSendMediaMessage = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

  server.tool(
    TOOL_NAME,
    'Send a media message from URL given in parameter to a contact on the specified channel. The contact can be a phone number in E.164 format, or the identifier for the specified channel. The media must be specified with its URL.',
    {
      recipient: Recipient,
      url: z.string().describe('The URL of the media that will be the content of the message.'),
      channel: ConversationChannel,
      appId: ConversationAppIdOverride,
      sender: MessageSenderNumberOverride,
      region: ConversationRegionOverride
    },
    sendMediaMessageHandler
  );
};

export const sendMediaMessageHandler = async({
  recipient,
  channel,
  url,
  appId,
  sender,
  region
}: {
  recipient: string;
  channel: string[];
  url: string;
  appId?: string;
  sender?: string;
  region?: string;
}): Promise<IPromptResponse> => {
  const maybeAppId = getConversationAppId(appId);
  if (isPromptResponse(maybeAppId)) {
    return maybeAppId.promptResponse;
  }
  const conversationAppId = maybeAppId;

  const maybeClient = getConversationClient(TOOL_NAME);
  if (isPromptResponse(maybeClient)) {
    return maybeClient.promptResponse;
  }
  const sinchClient = maybeClient;
  const usedRegion = setConversationRegion(region, sinchClient);

  const requestBase = await buildMessageBase(sinchClient, conversationAppId, recipient, channel, sender);
  const request: Conversation.SendMediaMessageRequestData<Conversation.IdentifiedBy> = {
    sendMessageRequestBody: {
      ...requestBase,
      message: {
        media_message: {
          url: url
        }
      }
    }
  };

  try {
    const response = await sinchClient.conversation.messages.sendMediaMessage(request);
    return new PromptResponse(JSON.stringify({
      success: true,
      message_id: response.message_id
    })).promptResponse;
  } catch (error) {
    return new PromptResponse(JSON.stringify({
      success: false,
      error: (error instanceof Error ? error.message : String(error)) + `. Are you sure you are using the right region to send your message? The current region is ${usedRegion}.`
    })).promptResponse;
  }
};
