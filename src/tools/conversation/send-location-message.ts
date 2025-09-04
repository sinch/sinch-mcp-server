import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Conversation } from '@sinch/sdk-core';
import { z } from 'zod';
import {
  getConversationAppId,
  getConversationRegion,
  getConversationClient,
} from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, shouldRegisterTool } from './utils/conversation-tools-helper';
import {
  Recipient,
  ConversationAppIdOverride,
  ConversationChannel,
  ConversationRegionOverride,
  MessageSenderNumberOverride,
} from './prompt-schemas';
import { isPromptResponse } from '../../utils';
import { buildMessageBase } from './utils/send-message-builder';
import { getLatitudeLongitudeFromAddress } from './utils/geocoding';
import { IPromptResponse, PromptResponse, Tags } from '../../types';

const location = z.object({
  lat: z.number().optional(),
  long: z.number().optional(),
  title: z.string().optional(),
  address: z.string().optional(),
});

const TOOL_KEY: ConversationToolKey = 'sendLocationMessage';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerSendLocationMessage = (server: McpServer, tags: Tags[]) => {
  if (!shouldRegisterTool(TOOL_KEY, tags)) return;

  server.tool(
    TOOL_NAME,
    'Send a location message from an address given in parameter to a contact on the specified channel. The contact can be a phone number in E.164 format, or the identifier for the specified channel.',
    {
      recipient: Recipient,
      address: location.describe('It can either be the plain text address that will be converted into latitude /longitude or directly the latitude / longitude coordinates if the user wants to send a specific location.'),
      channel: ConversationChannel,
      appId: ConversationAppIdOverride,
      sender: MessageSenderNumberOverride,
      region: ConversationRegionOverride,
    },
    sendLocationMessageHandler
  );
};

export const sendLocationMessageHandler = async ({
  recipient,
  channel,
  address,
  appId,
  sender,
  region
}: {
  recipient: string;
  channel: string[];
  address: { lat?: number; long?: number; title?: string; address?: string; };
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

  let latitude = 0, longitude = 0;
  let formattedAddress = 'Default tile';
  if (address.address) {
    const geocodingAddress = await getLatitudeLongitudeFromAddress(address.address);
    latitude = geocodingAddress.latitude;
    longitude = geocodingAddress.longitude;
    formattedAddress = geocodingAddress.formattedAddress;
  } else if (address.lat && address.long && address.title) {
    latitude = address.lat;
    longitude = address.long;
    formattedAddress = address.title;
  }
  const requestBase = await buildMessageBase(sinchClient, conversationAppId, recipient, channel, sender);
  const request: Conversation.SendLocationMessageRequestData<Conversation.IdentifiedBy> = {
    sendMessageRequestBody: {
      ...requestBase,
      message: {
        location_message: {
          coordinates: {
            longitude,
            latitude
          },
          title: formattedAddress
        }
      }
    }
  };

  let response: Conversation.SendMessageResponse;
  let reply: string;
  try{
    response = await sinchClient.conversation.messages.sendLocationMessage(request);
    reply = `Location message (${longitude}, ${latitude}) submitted on channel ${channel}! The message ID is ${response.message_id}`;
  } catch (error) {
    reply = `An error occurred when trying to send the location message: ${JSON.stringify(error)}. Are you sure you are using the right region to send your message? The current region is ${region}.`;
  }

  return new PromptResponse(reply).promptResponse;
};
