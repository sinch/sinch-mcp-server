import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Conversation } from '@sinch/sdk-core';
import { z } from 'zod';
import { getConversationAppId, getConversationRegion, getConversationService } from './utils/conversation-service-helper';
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
import { PromptResponse } from '../../types';

const locationAsCoordinates = z.object({
  lat: z.number(),
  long: z.number(),
  title: z.string()
});

const locationAsAddress = z.string();

const location = z.union([locationAsAddress, locationAsCoordinates]);

export const registerSendLocationMessage = (server: McpServer) => {
  server.tool(
    'send-location-message',
    'Send a location message from an address given in parameter to a contact on the specified channel. The contact ccan be a phone number in E.164 format, or the identifier for the specified channel.',
    {
      recipient: Recipient,
      address: location.describe('It can either be the plain text address that will be converted into latitude /longitude or directly the latitude / longitude coordinates if the user wants to send a specific location.'),
      channel: ConversationChannel,
      appId: ConversationAppIdOverride,
      sender: MessageSenderNumberOverride,
      region: ConversationRegionOverride,
    },
    async ({ address, recipient, channel, appId, sender, region }) => {
      console.error(`Sending location message to ${recipient} on channel ${channel}`);

      const maybeAppId = getConversationAppId(appId);
      if (isPromptResponse(maybeAppId)) {
        return maybeAppId.promptResponse;
      }
      const conversationAppId = maybeAppId;

      const maybeClient = getConversationService();
      if (isPromptResponse(maybeClient)) {
        return maybeClient.promptResponse;
      }
      const sinchClient = maybeClient;
      const conversationRegion = getConversationRegion(region);
      sinchClient.conversation.setRegion(conversationRegion);

      let latitude, longitude, formattedAddress;
      if (typeof address === 'string') {
        const geocodingAddress = await getLatitudeLongitudeFromAddress(address);
        latitude = geocodingAddress.latitude;
        longitude = geocodingAddress.longitude;
        formattedAddress = geocodingAddress.formattedAddress;
      } else {
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
    });
};
