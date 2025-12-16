import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Conversation } from '@sinch/sdk-core';
import { z } from 'zod';
import { Recipient, ConversationAppIdOverride, ConversationChannel, ConversationRegionOverride, MessageSenderNumberOverride } from './prompt-schemas';
import {
  getConversationAppId,
  getConversationClient,
  setConversationRegion,
} from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, shouldRegisterTool } from './utils/conversation-tools-helper';
import { isPromptResponse } from '../../utils';
import { buildMessageBase } from './utils/send-message-builder';
import { IPromptResponse, PromptResponse, Tags } from '../../types';

const TOOL_KEY: ConversationToolKey = 'sendMediaMessage';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerSendMediaMessage = (server: McpServer, tags: Tags[]) => {
  if (!shouldRegisterTool(TOOL_KEY, tags)) return;

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
  channel: string | string[];
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
  setConversationRegion(region, sinchClient);

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

  let response: Conversation.SendMessageResponse;
  let reply: string;
  try{
    response = await sinchClient.conversation.messages.sendMediaMessage(request);
    reply = `Media message submitted on channel ${channel}! The message ID is ${response.message_id}`;
  } catch (error) {
    reply = `An error occurred when trying to send the media message: ${JSON.stringify(error)}. Are you sure you are using the right region to send your message? The current region is ${region}.`;
  }

  return new PromptResponse(reply).promptResponse;
};
