import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Conversation } from '@sinch/sdk-core';
import {
  getConversationAppId,
  getConversationRegion,
  getConversationClient,
} from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, shouldRegisterTool } from './utils/conversation-tools-helper';
import { isPromptResponse } from '../../utils';
import { buildMessageBase } from './utils/send-message-builder';
import {
  Recipient,
  ConversationAppIdOverride,
  ConversationChannel,
  ConversationRegionOverride,
  MessageSenderNumberOverride,
  TextMessage,
} from './prompt-schemas';
import { IPromptResponse, PromptResponse, Tags } from '../../types';

const TOOL_KEY: ConversationToolKey = 'sendTextMessage';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerSendTextMessage = (server: McpServer, tags: Tags[]) => {
  if (!shouldRegisterTool(TOOL_KEY, tags)) return;

  server.tool(
    TOOL_NAME,
    'Send a text message to a contact on the specified channel. The contact can be a phone number in E.164 format, or the identifier for the specified channel.',
    {
      recipient: Recipient,
      message: TextMessage,
      channel: ConversationChannel,
      appId: ConversationAppIdOverride,
      sender: MessageSenderNumberOverride,
      region: ConversationRegionOverride,
    },
    sendTextMessageHandler
  );
};

export const sendTextMessageHandler = async({
  recipient,
  channel,
  message,
  appId,
  sender,
  region,
}: {
  message: string;
  channel: string[];
  recipient: string;
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
  const conversationRegion = getConversationRegion(region);
  sinchClient.conversation.setRegion(conversationRegion);

  const requestBase = await buildMessageBase(sinchClient, conversationAppId, recipient, channel, sender);
  const request: Conversation.SendTextMessageRequestData<Conversation.IdentifiedBy> = {
    sendMessageRequestBody: {
      ...requestBase,
      message: {
        text_message: {
          text: message
        }
      }
    }
  };

  let response: Conversation.SendMessageResponse;
  let reply: string;
  try{
    response = await sinchClient.conversation.messages.sendTextMessage(request);
    reply = `Text message submitted on channel ${channel}! The message ID is ${response.message_id}`;
  } catch (error) {
    reply = `An error occurred when trying to send the text message: ${JSON.stringify(error)}. Are you sure you are using the right region to send your message? The current region is ${region}.`;
  }

  return new PromptResponse(reply).promptResponse;
};
