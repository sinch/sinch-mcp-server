import { Conversation } from '@sinch/conversation';
import { z } from 'zod';
import { getLatitudeLongitudeFromAddress } from './geocoding';

export const choiceMessage = z
  .object({
    phone_number: z.string().optional().describe('E.164 format'),
    lat: z.number().optional(),
    long: z.number().optional(),
    address: z.string().optional(),
    text: z.string().optional(),
    url: z.string().url().optional(),
    title: z.string().optional(),
  })
  .refine(
    (data) =>
      Number(!!data.text) +
        Number(!!data.url) +
        Number(!!data.phone_number) +
        Number((typeof data.lat === 'number' && typeof data.long === 'number') || !!data.address) ===
      1,
    { message: 'Must provide exactly one type of choice: call, location, text, or URL' },
  )
  .refine((data) => !(data.text && data.title), {
    message: 'A text choice does not support a title: the text itself is displayed',
    path: ['title'],
  })
  .refine((data) => !(data.address && (typeof data.lat === 'number' || typeof data.long === 'number')), {
    message: 'A location choice takes either lat and long, or address, but not both',
    path: ['address'],
  })
  .describe(
    'Choice message that can be a call, location, text, or URL. Exactly one must be provided. The "title" parameter must not be provided in case of text choice.',
  );

export type ChoiceMessage = z.infer<typeof choiceMessage>;

export const buildChoices = async (choiceContent: ChoiceMessage[] = []): Promise<Conversation.Choice[]> => {
  const choices: Conversation.Choice[] = [];
  for (const choice of choiceContent) {
    if (choice.phone_number) {
      choices.push({
        call_message: {
          phone_number: choice.phone_number,
          title: choice.title,
        },
      } as Conversation.CallMessageChoice);
    } else if ('lat' in choice && 'long' in choice) {
      choices.push({
        location_message: {
          coordinates: {
            latitude: choice.lat,
            longitude: choice.long,
          },
          title: choice.title,
        },
      } as Conversation.LocationMessageChoice);
    } else if ('address' in choice && choice.address) {
      const coordinates = await getLatitudeLongitudeFromAddress(choice.address);
      choices.push({
        location_message: {
          coordinates: {
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
          },
          title: coordinates.formattedAddress,
        },
      } as Conversation.LocationMessageChoice);
    } else if (choice.text) {
      choices.push({
        text_message: {
          text: choice.text,
        },
      } as Conversation.TextMessageChoice);
    } else if (choice.url) {
      choices.push({
        url_message: {
          url: choice.url,
          title: choice.title,
        },
      } as Conversation.UrlMessageChoice);
    }
  }
  return choices;
};
