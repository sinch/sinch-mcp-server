import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Conversation } from '@sinch/sdk-core';
import axios from 'axios';
import { z } from 'zod';
import { buildSinchClient, getConversationAppId, getConversationCredentials } from './credentials.js';
import { buildMessageBase } from './messageBuilder.js';

export const registerSendLocationMessage = (server: McpServer) => {
  server.tool(
    'send-location-message',
    'Send a location message from an address given in parameter to a contact on the specified channel. The contact ccan be a phone number in E.164 format, or the identifier for the specified channel.',
    {
      contact: z.string().describe('The contact to send the location message to. This can be a phone number in E.164 format, or the identifier for the specified channel.'),
      address: z.string().describe('The address to be converted into longitude / latitude and sent as the body of the location message.'),
      channel: z.enum(['WHATSAPP', 'RCS', 'SMS', 'MESSENGER', 'VIBER', 'VIBERBM', 'MMS', 'INSTAGRAM', 'TELEGRAM', 'KAKAOTALK', 'KAKAOTALKCHAT', 'LINE', 'WECHAT', 'APPLEBC'])
        .describe('The channel to use for sending the message. Can be \'WHATSAPP\', \'RCS\', \'SMS\', \'MESSENGER\', \'VIBER\', \'VIBERBM\', \'MMS\', \'INSTAGRAM\', \'TELEGRAM\', \'KAKAOTALK\', \'KAKAOTALKCHAT\', \'LINE\', \'WECHAT\' or \'APPLEBC\'.'),
      appId: z.string().optional().describe('The ID of the app to use for the Sinch conversation API.'),
      sender: z.string().optional().describe('(Optional) The sender of the message. It is a phone number in E.164 format.'),
      sessionId: z.string().optional().describe('Optional session ID to track the user')
    },
    async ({ address, contact, channel, appId, sender, sessionId }) => {
      // Send location message
      console.error(`Sending location message to ${contact} on channel ${channel}: ${address}`);

      const credentials = await getConversationCredentials(sessionId);
      if ('promptResponse' in credentials) {
        console.error(`No token found for the session ${credentials.sessionId}`);
        return credentials.promptResponse;
      }

      const conversationAppId = getConversationAppId(appId);
      if (typeof conversationAppId !== 'string') {
        console.error('No app ID provided.');
        return conversationAppId;
      }

      const sinchClient = buildSinchClient(credentials);
      const [longitude, latitude, formattedAddress] = await getCoordinatesFromAddress(address);
      const requestBase = buildMessageBase(conversationAppId, contact, channel);
      const request: Conversation.SendLocationMessageRequestData<Conversation.IdentifiedBy> = {
        sendMessageRequestBody: {
          ...requestBase,
          message: {
            location_message: {
              coordinates: {
                longitude,
                latitude
              },
              title: formattedAddress,
              label: formattedAddress
            }
          }
        }
      };

      if(!sender) {
        sender = process.env.DEFAULT_SMS_ORIGINATOR;
      }
      if (sender) {
        request.sendMessageRequestBody.channel_properties = {
          'SMS_SENDER': sender
        };
      }

      const response = await sinchClient.conversation.messages.sendLocationMessage(request);

      return {
        content: [
          {
            type: 'text',
            text: `Location message (${longitude}, ${latitude}) submitted on channel ${channel}! The message ID is ${response.message_id}`
          }
        ]
      };
    });
};

const getCoordinatesFromAddress = async (address: string): Promise<[number, number, string]> => {
  const url = 'https://api.geoapify.com/v1/geocode/search';
  const queryParams = {
    text: address,
    apiKey: process.env.GEOAPIFY_API_KEY
  };
  let coordinates = [0, 0, 'Unknown'];
  try {
    const response = await axios.get(url, {
      params: queryParams
    });
    coordinates = [...response.data.features[0].geometry.coordinates, response.data.features[0].properties.formatted];
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Request failed:', error.message);
    } else {
      console.error('Unknown error occurred');
    }
  }
  return coordinates as [number, number, string];
};
