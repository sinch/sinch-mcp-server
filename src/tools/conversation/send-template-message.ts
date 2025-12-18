import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Conversation } from '@sinch/sdk-core';
import { z } from 'zod';
import { IPromptResponse, PromptResponse, Tags } from '../../types';
import { isPromptResponse } from '../../utils';
import {
  getConversationAppId,
  getConversationClient,
  setConversationRegion,
} from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, shouldRegisterTool } from './utils/conversation-tools-helper';
import { buildMessageBase } from './utils/send-message-builder';
import { Recipient, ConversationAppIdOverride, ConversationChannel, ConversationRegionOverride, MessageSenderNumberOverride } from './prompt-schemas';

const TOOL_KEY: ConversationToolKey = 'sendTemplateMessage';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerSendTemplateMessage = (server: McpServer, tags: Tags[]) => {
  if (!shouldRegisterTool(TOOL_KEY, tags)) return;

  server.tool(
    TOOL_NAME,
    'Send a template message to a contact on the specified channel. The contact can be a phone number in E.164 format, or the identifier for the specified channel.',
    {
      recipient: Recipient,
      templateId: z.string()
        .describe('The ID (ULID format) of the omni-template template to use for sending the message.'),
      language: z.string().optional()
        .describe('The language to use for the omni-template (BCP-47). If not set, the default language code will be used.'),
      parameters: z.record(z.string(), z.string()).optional()
        .describe('The parameters to use for the template. This is a key-value map where the key is the parameter name and the value is the parameter value. Look carefully in the prompt to find which parameters are expected by the template.'),
      channel: ConversationChannel,
      appId: ConversationAppIdOverride,
      sender: MessageSenderNumberOverride,
      region: ConversationRegionOverride
    },
    sendTemplateMessageHandler
  );
};

export const sendTemplateMessageHandler = async ({
  recipient,
  channel,
  templateId,
  language,
  parameters,
  appId,
  sender,
  region
}: {
  recipient: string;
  channel: string[];
  templateId: string;
  language?: string;
  parameters?: Record<string, string>;
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
  const omniChannelMessage: Conversation.TemplateMessageItem = {
    omni_template: {
      template_id: templateId,
      version: 'latest',
      parameters: {
        ...parameters
      }
    }
  };
  if (language) {
    omniChannelMessage.omni_template!.language_code = language;
  }

  const request: Conversation.SendTemplateMessageRequestData<Conversation.IdentifiedBy> = {
    sendMessageRequestBody: {
      ...requestBase,
      message: {
        template_message: {
          ...omniChannelMessage
        }
      }
    }
  };

  let response: Conversation.SendMessageResponse;
  let reply: string;
  try {
    response = await sinchClient.conversation.messages.sendTemplateMessage(request);
    reply = `Template message submitted on channel ${channel}! The message ID is ${response.message_id}`;
  } catch (error) {
    reply = `An error occurred when trying to send the template message: ${JSON.stringify(error)}. Are you sure you are using the right region to send your message? The current region is ${usedRegion}.`;
  }

  return new PromptResponse(reply).promptResponse;
};
