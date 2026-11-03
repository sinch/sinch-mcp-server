import { Conversation } from '@sinch/conversation';
import { z } from 'zod';
import { buildChoices, ChoiceMessage } from './choice-builder';

export const CARD_TITLE_MAX_LENGTH = 200;
export const CARD_DESCRIPTION_MAX_LENGTH = 2000;

export const cardTitle = z
  .string()
  .max(CARD_TITLE_MAX_LENGTH)
  .describe(`The title of the card, displayed above the description. Up to ${CARD_TITLE_MAX_LENGTH} characters.`);

export const cardDescription = z
  .string()
  .max(CARD_DESCRIPTION_MAX_LENGTH)
  .optional()
  .describe(
    `The text displayed below the title on the card. Up to ${CARD_DESCRIPTION_MAX_LENGTH} characters. Put the long part of the content here, not in the title.`,
  );

export const cardMediaUrl = z.string().url().describe('The media URL to be displayed on the card');

export interface CardContent {
  title: string;
  description?: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  height?: Conversation.CardHeight;
  choiceContent?: ChoiceMessage[];
}

export const buildCard = async (card: CardContent): Promise<Conversation.CardMessageItem> => ({
  title: card.title,
  description: card.description,
  height: card.height,
  media_message: {
    url: card.mediaUrl,
    thumbnail_url: card.thumbnailUrl,
  },
  choices: await buildChoices(card.choiceContent),
});
