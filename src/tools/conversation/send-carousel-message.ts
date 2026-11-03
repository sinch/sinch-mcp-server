import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTracedTool } from '../../telemetry/register-traced-tool';
import { z } from 'zod';
import {
  getConversationAppId,
  getConversationService,
  setConversationRegion,
} from './utils/conversation-service-helper';
import { ConversationToolKey, getToolName, toolsConfig } from './utils/conversation-tools-helper';
import { buildMessageBase, formatSendError } from './utils/send-message-builder';
import { buildChoices, choiceMessage } from './utils/choice-builder';
import { buildCard, cardDescription, cardMediaUrl, cardTitle } from './utils/card-builder';
import {
  Recipient,
  ConversationAppIdOverride,
  ConversationChannel,
  ConversationRegionOverride,
  MessageSenderNumberOverride,
} from './prompt-schemas';
import { isPromptResponse, matchesAnyTag } from '../../utils';
import { IPromptResponse, PromptResponse, Tags } from '../../types';

const MAX_CARDS = 10;
const MAX_CARD_CHOICES = 4;
const MAX_CAROUSEL_CHOICES = 3;
const MESSAGE_METADATA_MAX_LENGTH = 1024;

const carouselCard = z.object({
  title: cardTitle,
  description: cardDescription,
  mediaUrl: cardMediaUrl,
  thumbnailUrl: z
    .string()
    .optional()
    .describe(
      'The URL of a preview image for the media, used when the channel supports it, for example the still frame of a video',
    ),
  height: z
    .enum(['SHORT', 'MEDIUM', 'TALL'])
    .optional()
    .describe('The height of the media on the card. SHORT, MEDIUM, or TALL.'),
  choiceContent: z
    .array(choiceMessage)
    .max(MAX_CARD_CHOICES)
    .optional()
    .describe(`The list of choices displayed on this card. Up to ${MAX_CARD_CHOICES} choices, the RCS limit.`),
});

export const SendCarouselMessageSchema = {
  recipient: Recipient,
  cards: z
    .array(carouselCard)
    .min(1)
    .max(MAX_CARDS)
    .describe(`The list of swipeable cards of the carousel. From 1 to ${MAX_CARDS} cards.`),
  carouselChoices: z
    .array(choiceMessage)
    .max(MAX_CAROUSEL_CHOICES)
    .optional()
    .describe(`The list of choices displayed below the carousel. Up to ${MAX_CAROUSEL_CHOICES} choices.`),
  metadata: z
    .string()
    .max(MESSAGE_METADATA_MAX_LENGTH)
    .optional()
    .describe(
      `Metadata attached to the message and returned in the delivery receipt, for example a campaign name. Up to ${MESSAGE_METADATA_MAX_LENGTH} characters.`,
    ),
  channel: ConversationChannel,
  appId: ConversationAppIdOverride,
  sender: MessageSenderNumberOverride,
  region: ConversationRegionOverride,
};

type SendCarouselMessage = z.infer<z.ZodObject<typeof SendCarouselMessageSchema>>;

const TOOL_KEY: ConversationToolKey = 'sendCarouselMessage';
const TOOL_NAME = getToolName(TOOL_KEY);

export const registerSendCarouselMessage = (server: McpServer, tags: Tags[]) => {
  if (!matchesAnyTag(tags, toolsConfig[TOOL_KEY].tags)) {
    return;
  }

  registerTracedTool(
    server,
    TOOL_NAME,
    {
      description:
        'Send a carousel message to the user: a list of swipeable cards, each one with a media, a title, an optional description and an optional list of choices. The carousel itself can carry its own choices, displayed below the cards. Each choice can be a call message (phone number + title to display next to it), a location message (latitude / longitude + title to display next to it), a text message or a URL message (the URL to click on + title to display next to it). The contact can be a phone number in E.164 format, or the identifier for the specified channel. To send a single card, use the send-card-message tool instead.',
      inputSchema: SendCarouselMessageSchema,
    },
    sendCarouselMessageHandler,
  );
};

export const sendCarouselMessageHandler = async ({
  recipient,
  channel,
  cards,
  carouselChoices,
  metadata,
  appId,
  sender,
  region,
}: SendCarouselMessage): Promise<IPromptResponse> => {
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

  const cardItems = [];
  for (const card of cards) {
    cardItems.push(await buildCard(card));
  }
  const choices = await buildChoices(carouselChoices);

  try {
    const requestBase = await buildMessageBase(conversationService, conversationAppId, recipient, channel, sender);
    const response = await conversationService.messages.sendCarouselMessage({
      sendMessageRequestBody: {
        ...requestBase,
        message_metadata: metadata,
        message: {
          carousel_message: {
            cards: cardItems,
            choices,
          },
        },
      },
    });
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
