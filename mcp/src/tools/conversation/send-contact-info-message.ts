import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Conversation } from '@sinch/sdk-core';
import { z } from 'zod';
import { getConversationAppId, getConversationRegion, getConversationService } from './utils/conversation-service-helper';
import { buildMessageBase } from './utils/send-message-builder';
import { isPromptResponse } from '../../utils';
import {
  Recipient,
  ConversationAppIdOverride,
  ConversationChannel,
  ConversationRegionOverride,
  MessageSenderNumberOverride,
} from './prompt-schemas';
import { PromptResponse } from '../../types';

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

export const registerSendContactInfoMessage = (server: McpServer) => {
  server.tool(
    'send-contact-info-message',
    'Send a contact info message to a recipient.',
    {
      recipient: Recipient,
      contactName: NameModel.describe('The name of the contact.'),
      contactPhoneNumbers: z.array(PhoneNumberModel).describe('The phone number of the contact.'),
      contactEmailAddresses: z.array(EmailAddressModel).optional().describe('The email address of the contact.'),
      contactAddresses: z.array(AddressModel).optional().describe('The address of the contact.'),
      channel: ConversationChannel,
      appId: ConversationAppIdOverride,
      sender: MessageSenderNumberOverride,
      region: ConversationRegionOverride,
    },
    async ({ recipient, contactName, contactPhoneNumbers, contactEmailAddresses, contactAddresses, channel, appId, sender, region }) => {
      console.error(`Sending contact info message to ${recipient}`);

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

      const requestBase = await buildMessageBase(sinchClient, conversationAppId, recipient, channel, sender);
      const request: Conversation.SendContactInfoMessageRequestData<Conversation.IdentifiedBy> = {
        sendMessageRequestBody: {
          ...requestBase,
          message: {
            contact_info_message: {
              name: {
                full_name: contactName.fullName,
                first_name: contactName.firstName,
                last_name: contactName.lastName,
                middle_name: contactName.middleName,
                prefix: contactName.prefix,
                suffix: contactName.suffix
              },
              phone_numbers: contactPhoneNumbers.map(phone => ({
                phone_number: phone.phoneNumber,
                type: phone.type
              })),
              email_addresses: contactEmailAddresses?.map(email => ({
                email_address: email.emailAddress,
                type: email.type
              })) || [],
              addresses: contactAddresses?.map(address => ({
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

      return new PromptResponse(reply).promptResponse;
    }
  );
};
