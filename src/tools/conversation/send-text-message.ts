import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Conversation } from '@sinch/conversation';
import {
  getConversationAppId,
  setConversationRegion,
  getConversationService,
} from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import { isPromptResponse, matchesAnyTag } from '../../utils';
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
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) return;

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

  const maybeService = getConversationService(TOOL_NAME);
  if (isPromptResponse(maybeService)) {
    return maybeService.promptResponse;
  }
  const conversationService = maybeService;
  const usedRegion = setConversationRegion(region, conversationService);

  const requestBase = await buildMessageBase(conversationService, conversationAppId, recipient, channel, sender);
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

  try{
    const response = await conversationService.messages.sendTextMessage(request);
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
