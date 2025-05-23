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

const NameModel = z.object({
  fullName: z.string().describe('Full name of the contact.'),
  firstName: z.string().optional().describe('First name of the contact.'),
  lastName: z.string().optional().describe('Last name of the contact.'),
  middleName: z.string().optional().describe('Middle name of the contact.'),
  prefix: z.string().optional().describe('Prefix of the contact.'),
  suffix: z.string().optional().describe('Suffix of the contact.')
});

const PhoneNumberModel = z.object({
  phoneNumber: z.string().describe('Phone number of the contact with country code included.'),
  type: z.string().optional().describe('Type of the phone number, e.g., mobile, home, work.')
});

const EmailAddressModel = z.object({
  emailAddress: z.string().describe('Email address of the contact.'),
  type: z.string().optional().describe('Type of the email address, e.g., mobile, home, work.')
});

const AddressModel = z.object({
  city: z.string().optional().describe('City of the contact.'),
  country: z.string().optional().describe('Country of the contact.'),
  state: z.string().optional().describe('State of the contact.'),
  zipCode: z.string().optional().describe('ZIP code of the contact.'),
  type: z.string().optional().describe('Type of the address, e.g., home, work.'),
  countryCode: z.string().optional().describe('Two letters country code of the contact.')
});

const ChannelEnum = z.enum([
  'WHATSAPP', 'RCS', 'SMS', 'MESSENGER', 'VIBER', 'VIBERBM',
  'MMS', 'INSTAGRAM', 'TELEGRAM', 'KAKAOTALK', 'KAKAOTALKCHAT',
  'LINE', 'WECHAT'
]);

export const registerSendContactInfoMessage = (server: McpServer) => {
  server.tool(
    'send-contact-info-message',
    'Send a contact info message to a recipient.',
    {
      recipient: z.string().describe('The recipient of the contact info message.'),
      name: NameModel.describe('The name of the contact.'),
      phoneNumbers: z.array(PhoneNumberModel).describe('The phone number of the contact.'),
      emailAddresses: z.array(EmailAddressModel).optional().describe('The email address of the contact.'),
      addresses: z.array(AddressModel).optional().describe('The address of the contact.'),
      channel: z.union([ChannelEnum, z.array(ChannelEnum).nonempty()])
        .describe('The channel to use for sending the message. Can be \'WHATSAPP\', \'RCS\', \'SMS\', \'MESSENGER\', \'VIBER\', \'VIBERBM\', \'MMS\', \'INSTAGRAM\', \'TELEGRAM\', \'KAKAOTALK\', \'KAKAOTALKCHAT\', \'LINE\' or \'WECHAT\'.'),
      appId: z.string().optional().describe('The ID of the app to use for the Sinch conversation API. If set, it will override the value from the environment variable CONVERSATION_APP_ID.'),
      sender: z.string().optional().describe('The sender of the message. It is a phone number in E.164 format.'),
      region: z.enum(['us', 'eu', 'br']).optional().describe('The region to use for the Sinch conversation API. If set, it will override the value from the environment variable CONVERSATION_REGION.'),
      sessionId: z.string().optional().describe('Optional session ID to track the user')
    },
    async ({ recipient, name, phoneNumbers, emailAddresses, addresses, channel, appId, sender, region, sessionId }) => {
      console.error(`Sending contact info message to ${recipient}`);

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
      const conversationRegion = getConversationRegion(region);
      sinchClient.conversation.setRegion(conversationRegion);

      const requestBase = await buildMessageBase(sinchClient, conversationAppId, recipient, channel, sender);
      const request: Conversation.SendContactInfoMessageRequestData<Conversation.IdentifiedBy> = {
        sendMessageRequestBody: {
          ...requestBase,
          message: {
            contact_info_message: {
              name: {
                full_name: name.fullName,
                first_name: name.firstName,
                last_name: name.lastName,
                middle_name: name.middleName,
                prefix: name.prefix,
                suffix: name.suffix
              },
              phone_numbers: phoneNumbers.map(phone => ({
                phone_number: phone.phoneNumber,
                type: phone.type
              })),
              email_addresses: emailAddresses?.map(email => ({
                email_address: email.emailAddress,
                type: email.type
              })) || [],
              addresses: addresses?.map(address => ({
                city: address.city,
                country: address.country,
                state: address.state,
                zip_code: address.zipCode,
                type: address.type,
                country_code: address.countryCode
              })) || []
            }
          }
        }
      };

      let response: Conversation.SendMessageResponse;
      let reply: string;
      try{
        response = await sinchClient.conversation.messages.sendContactInfoMessage(request);
        reply = `Contact Info message submitted on channel ${channel}! The message ID is ${response.message_id}`;
      } catch (error) {
        reply = `An error occurred when trying to send the text message: ${JSON.stringify(error)}. Are you sure you are using the right region to send your message? The current region is ${region}.`;
      }

      return {
        content: [
          {
            type: 'text',
            text: reply
          }
        ]
      };
    }
  );
};
