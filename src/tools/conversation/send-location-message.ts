import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { Conversation } from '@sinch/conversation';
import { z } from 'zod';
import {
  getConversationAppId,
  getConversationService,
  setConversationRegion,
} from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import {
  Recipient,
  ConversationAppIdOverride,
  ConversationChannel,
  ConversationRegionOverride,
  MessageSenderNumberOverride,
} from './prompt-schemas';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { buildMessageBase, formatSendError } from './utils/send-message-builder';
import { getLatitudeLongitudeFromAddress } from './utils/geocoding';
import { IPromptResponse, PromptResponse, Tags } from '../../types';

const location = z.object({
  lat: z.number().optional().describe('Latitude; used only when long and title are also provided.'),
  long: z.number().optional().describe('Longitude; used only when lat and title are also provided.'),
  title: z
    .string()
    .optional()
    .describe(
      'Shown close to the button or link that leads to a map showing the location; used only when lat and long are also provided (the geocoded address is used instead when the address field is set).',
    ),
  label: z.string().optional().describe('Label or name for the position.'),
  address: z.string().optional().describe('Address to geocode into latitude/longitude coordinates.'),
});

const LocationMessageSchema = {
  recipient: Recipient,
  address: location.describe(
    'It can either be the plain text address that will be converted into latitude /longitude or directly the latitude / longitude coordinates if the user wants to send a specific location.',
  ),
  channel: ConversationChannel,
  appId: ConversationAppIdOverride,
  sender: MessageSenderNumberOverride,
  region: ConversationRegionOverride,
};

type LocationMessage = z.infer<z.ZodObject<typeof LocationMessageSchema>>;

const TOOL_KEY: ConversationToolKey = 'sendLocationMessage';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerSendLocationMessage = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'Send a location message from an address given in parameter to a contact on the specified channel. The contact can be a phone number in E.164 format, or the identifier for the specified channel.',
      inputSchema: LocationMessageSchema,
    },
    sendLocationMessageHandler,
  );
};

export const sendLocationMessageHandler = async ({
  recipient,
  channel,
  address,
  appId,
  sender,
  region,
}: LocationMessage): Promise<IPromptResponse> => {
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

  let latitude = 0,
    longitude = 0;
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

  try {
    const requestBase = await buildMessageBase(conversationService, conversationAppId, recipient, channel, sender);
    const request: Conversation.SendLocationMessageRequestData<Conversation.IdentifiedBy> = {
      sendMessageRequestBody: {
        ...requestBase,
        message: {
          location_message: {
            coordinates: {
              longitude,
              latitude,
            },
            title: formattedAddress,
          },
        },
      },
    };

    if (address.label) {
      request.sendMessageRequestBody.message.location_message.label = address.label;
    }

    const response = await conversationService.messages.sendLocationMessage(request);
    return new PromptResponse(
      JSON.stringify({
        success: true,
        message_id: response.message_id,
      }),
    ).promptResponse;
  } catch (error) {
    return new PromptResponse(
      JSON.stringify({
        success: false,
        error: formatSendError(error, usedRegion),
      }),
    ).promptResponse;
  }
};
