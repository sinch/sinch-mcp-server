import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Conversation } from '@sinch/sdk-core';
import { z } from 'zod';
import {
  getConversationAppId,
  getConversationRegion,
  getConversationClient,
} from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, shouldRegisterTool } from './utils/conversation-tools-helper';
import { buildMessageBase } from './utils/send-message-builder';
import { getLatitudeLongitudeFromAddress } from './utils/geocoding';
import {
  Recipient,
  ConversationAppIdOverride,
  ConversationChannel,
  ConversationRegionOverride,
  MessageSenderNumberOverride,
} from './prompt-schemas';
import { isPromptResponse } from '../../utils';
import { IPromptResponse, PromptResponse, Tags } from '../../types';

const choiceMessage = z.object({
  // Call
  phone_number: z.string().optional().describe('E.164 format'),
  // Location
  lat: z.number().optional(),
  long: z.number().optional(),
  address: z.string().optional(),
  // Text
  text: z.string().optional(),
  // URL
  url: z.string().url().optional(),
  // Common
  title: z.string().optional()
}).refine(
  data =>
    Number(!!data.text) +
    Number(!!data.url) +
    Number(!!data.phone_number) +
    Number((!!data.lat && !!data.long) || !!data.address) === 1,
  { message: 'Must provide exactly one type of choice: call, location, text, or URL' }
).describe('Choice message that can be a call, location, text, or URL. Exactly one must be provided. The "title" parameter must not be provided is case of text choice.');

const TOOL_KEY: ConversationToolKey = 'sendCardOrChoiceMessage';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerSendCardOrChoiceMessage = (server: McpServer, tags: Tags[]) => {
  if (!shouldRegisterTool(TOOL_KEY, tags)) return;

  server.tool(
    TOOL_NAME,
    'Send a choice message to the user. The choice message can contain up to 3 choices if not text or up to 10 message if text only. Each choice can be a call message (phone number + title to display next to it), a location message (latitude / longitude + title to display next to it), a text message or a URL message (the URL to click on + title to display next to it). The contact can be a phone number in E.164 format, or the identifier for the specified channel.',
    {
      recipient: Recipient,
      choiceContent: z.array(choiceMessage).max(10).optional().describe('The list of choices to send to the user'),
      text: z.string().describe('The text to be sent along the choice array'),
      mediaUrl: z.string().optional().describe('The media URL to be sent along the choice array'),
      channel: ConversationChannel,
      appId: ConversationAppIdOverride,
      sender: MessageSenderNumberOverride,
      region: ConversationRegionOverride,
    },
    sendCardOrChoiceMessageHandler
  );
};

export const sendCardOrChoiceMessageHandler = async ({
  recipient,
  channel,
  choiceContent,
  text,
  mediaUrl,
  appId,
  sender,
  region
}: {
  recipient: string;
  channel: string[];
  choiceContent?: z.infer<typeof choiceMessage>[];
  text: string;
  mediaUrl?: string;
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

  const choices: Conversation.Choice[] = [];
  for (const choice of choiceContent || []) {
    if ('phone_number' in choice) {
      choices.push({
        call_message: {
          phone_number: choice.phone_number,
          title: choice.title
        }
      } as Conversation.CallMessageChoice);
    } else if ('lat' in choice && 'long' in choice) {
      choices.push({
        location_message: {
          coordinates: {
            latitude: choice.lat,
            longitude: choice.long
          },
          title: choice.title
        }
      } as Conversation.LocationMessageChoice);
    } else if ('address' in choice && choice.address) {
      const coordinates = await getLatitudeLongitudeFromAddress(choice.address);
      choices.push({
        location_message: {
          coordinates: {
            latitude: coordinates.latitude,
            longitude: coordinates.longitude
          },
          title: coordinates.formattedAddress
        }
      } as Conversation.LocationMessageChoice);
    } else if ('text' in choice) {
      choices.push({
        text_message: {
          text: choice.text
        }
      } as Conversation.TextMessageChoice);
    } else if ('url' in choice) {
      choices.push({
        url_message: {
          url: choice.url,
          title: choice.title
        }
      } as Conversation.UrlMessageChoice);
    }
  }

  const requestBase = await buildMessageBase(sinchClient, conversationAppId, recipient, channel, sender);

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

  return new PromptResponse(reply).promptResponse;
}
