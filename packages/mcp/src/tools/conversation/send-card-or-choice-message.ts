import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Conversation } from '@sinch/sdk-core';
import { z } from 'zod';
import {
  buildSinchClient,
  getConversationAppId,
  getConversationCredentials,
  getConversationRegion
} from './credentials.js';
import { buildMessageBase } from './messageBuilder.js';

const callChoice = z.object({
  phone_number: z.string(),
  title: z.string()
});

const locationChoice = z.object({
  lat: z.number(),
  long: z.number(),
  title: z.string()
});

const textChoice = z.object({
  text: z.string()
});

const urlChoice = z.object({
  url: z.string().url(),
  title: z.string()
});

const choiceMessage = z.union([
  callChoice,
  locationChoice,
  textChoice,
  urlChoice
]);

export const registerSendCardOrChoiceMessage = (server: McpServer) => {
  server.tool(
    'send-choice-message',
    'Send a choice message to the user. The choice message can contain up to 3 choices if not text or up to 10 message if text only. Each choice can be a call message (phone number + title to display next to it), a location message (latitude / longitude + title to display next to it), a text message or a URL message (the URL to click on + title to display next to it). The contact can be a phone number in E.164 format, or the identifier for the specified channel.',
    {
      contact: z.string().describe('The contact to send the text message to. This can be a phone number in E.164 format, or the identifier for the specified channel.'),
      choiceContent: z.array(choiceMessage).max(10).optional().describe('The list of choices to send to the user'),
      text: z.string().describe('The text to be sent along the choice array'),
      mediaUrl: z.string().optional().describe('The media URL to be sent along the choice array'),
      channel: z.enum(['WHATSAPP', 'RCS', 'SMS', 'MESSENGER', 'VIBER', 'VIBERBM', 'MMS', 'INSTAGRAM', 'TELEGRAM', 'KAKAOTALK', 'KAKAOTALKCHAT', 'LINE', 'WECHAT', 'APPLEBC'])
        .describe('The channel to use for sending the message. Can be \'WHATSAPP\', \'RCS\', \'SMS\', \'MESSENGER\', \'VIBER\', \'VIBERBM\', \'MMS\', \'INSTAGRAM\', \'TELEGRAM\', \'KAKAOTALK\', \'KAKAOTALKCHAT\', \'LINE\', \'WECHAT\' or \'APPLEBC\'.'),
      appId: z.string().optional().describe('The ID of the app to use for the Sinch conversation API. If set, it will override the value from the environment variable CONVERSATION_APP_ID.'),
      sender: z.string().optional().describe('(Optional) The sender of the message. It is a phone number in E.164 format.'),
      region: z.enum(['us', 'eu', 'br']).optional().describe('The region to use for the Sinch conversation API. If set, it will override the value from the environment variable CONVERSATION_REGION.'),
      sessionId: z.string().optional().describe('Optional session ID to track the user')
    }, async ({ contact, channel, choiceContent, text, mediaUrl, appId, sender, region, sessionId }) => {
      console.error(`Sending choice message to ${contact} on channel ${channel}`);

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

      const choices: Conversation.Choice[] = [];
      for (const choice of choiceContent || []) {
        if ('phone_number' in choice && 'title' in choice) {
          choices.push({
            call_message: {
              phone_number: choice.phone_number,
              title: choice.title
            }
          } as Conversation.CallMessageChoice);
        } else if ('lat' in choice && 'long' in choice && 'title' in choice) {
          choices.push({
            location_message: {
              coordinates: {
                latitude: choice.lat,
                longitude: choice.long
              },
              title: choice.title
            }
          } as Conversation.LocationMessageChoice);
        } else if ('text' in choice) {
          choices.push({
            text_message: {
              text: choice.text
            }
          } as Conversation.TextMessageChoice);
        } else if ('url' in choice && 'title' in choice) {
          choices.push({
            url_message: {
              url: choice.url,
              title: choice.title
            }
          } as Conversation.UrlMessageChoice);
        }
      }

      const sinchClient = buildSinchClient(credentials);
      const conversationRegion = getConversationRegion(region);
      sinchClient.conversation.setRegion(conversationRegion);

      const requestBase = buildMessageBase(conversationAppId, contact, channel, sender);

      let request: Conversation.SendChoiceMessageRequestData<Conversation.IdentifiedBy> | Conversation.SendCardMessageRequestData<Conversation.IdentifiedBy>;

      if (mediaUrl) {
        request = {
          sendMessageRequestBody: {
            ...requestBase,
            message: {
              card_message: {
                choices,
                title: text,
                media_message: {
                  url: mediaUrl
                }
              }
            }
          }
        };
      } else {
        request = {
          sendMessageRequestBody: {
            ...requestBase,
            message: {
              choice_message: {
                choices,
                text_message:{
                  text
                }
              }
            }
          }
        };
      }

      let response: Conversation.SendMessageResponse;
      let reply: string;
      try {
        if (mediaUrl) {
          response = await sinchClient.conversation.messages.sendCardMessage(request as Conversation.SendCardMessageRequestData<Conversation.IdentifiedBy>);
        } else {
          response = await sinchClient.conversation.messages.sendChoiceMessage(request as Conversation.SendChoiceMessageRequestData<Conversation.IdentifiedBy>);
        }
        reply = `${mediaUrl ? 'Card' : 'Choice'} message submitted on channel ${channel}! The message ID is ${response.message_id}`;
      } catch (error) {
        reply = `An error occurred when trying to send the ${mediaUrl ? 'card' : 'choice'} message: ${JSON.stringify(error)}. Are you sure you are using the right region to send your message? The current region is ${region}.`;
      }

      return {
        content: [
          {
            type: 'text',
            text: reply
          }
        ]
      };
    });
};
