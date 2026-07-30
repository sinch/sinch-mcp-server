export interface ToolTestCase {
  prompt: string;
  expectedToolName?: string;
  /** Exact match on the tool call's arguments (partial: only listed keys are checked). */
  expectedArguments?: Record<string, any>;
  /** Dot-path checks (e.g. `"address.title"`) for nested or model-phrased fields; use a RegExp for free text. */
  pathMatchers?: Record<string, RegExp | string | number | boolean>;
  /** Alternative tool names that also count as correct routing when routing is genuinely ambiguous. */
  accept?: string[];
}

// Cases grouped by MCP scope so it's clear which tools belong together. Tool
// names are guarded against the live server in tool-invocation.int.test.ts.

// No tool should be called — the model answers in text.
const generalCases: ToolTestCase[] = [
  {
    prompt: 'Which tools are available in the MCP server?',
    expectedToolName: undefined,
  },
  {
    prompt: 'Just say hi',
    expectedToolName: undefined,
  },
];

// Conversation API: messages, apps, channels, templates, webhooks.
const messagingCases: ToolTestCase[] = [
  {
    prompt: "Send a text message to +33612345678 saying 'Hello there!'",
    expectedToolName: 'send-text-message',
    expectedArguments: {
      recipient: '+33612345678',
      message: 'Hello there!',
      channel: ['SMS'],
    },
  },
  {
    prompt:
      'Send the product brochure PDF located at https://bit.ly/ABCDEF to the phone number +33612345678 on WhatsApp.',
    expectedToolName: 'send-media-message',
    expectedArguments: {
      recipient: '+33612345678',
      url: 'https://bit.ly/ABCDEF',
      channel: ['WHATSAPP'],
    },
  },
  {
    prompt:
      "Send a whatsapp message to +33612345678 with the template 'appt_reminder' in Spanish, with the parameter 'name' set to 'Mr. Smith'.",
    expectedToolName: 'send-whatsapp-template-message',
    expectedArguments: {
      recipient: '+33612345678',
      templateName: 'appt_reminder',
      templateLanguage: 'es',
      parameters: {
        name: 'Mr. Smith',
      },
    },
  },
  {
    prompt: 'Send a message to +33612345678 on SMS using the template 01ARZ3NDEKTSV4RRFFQ69G5FAV in English.',
    expectedToolName: 'send-template-message',
    expectedArguments: {
      recipient: '+33612345678',
      templateId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      language: 'en',
      channel: ['SMS'],
    },
  },
  {
    prompt:
      'Send a RCS survey about preferred ice cream flavor to +33612345678 with the following choices: Vanilla, Strawberry, Hazelnut',
    expectedToolName: 'send-choice-message',
    expectedArguments: {
      recipient: '+33612345678',
      channel: ['RCS'],
      choiceContent: [{ text: 'Vanilla' }, { text: 'Strawberry' }, { text: 'Hazelnut' }],
    },
    pathMatchers: {
      text: /ice cream flavor/i,
    },
  },
  {
    prompt:
      'Send a pin to the Guggenheim Museum location, Avenida Abandoibarra, 2 - 48009 Bilbao, Spain by SMS to the phone number +33612345678.',
    expectedToolName: 'send-location-message',
    expectedArguments: {
      recipient: '+33612345678',
      channel: ['SMS'],
    },
    pathMatchers: {
      'address.address': /(?=.*Abandoibarra)(?=.*48009)(?=.*Bilbao)/i,
    },
  },
  {
    prompt: 'What messaging apps do I have set up in my account?',
    expectedToolName: 'list-conversation-apps',
    expectedArguments: undefined,
  },
  {
    prompt: 'Create a Conversation app named Customer Support in the us region.',
    expectedToolName: 'create-conversation-app',
    expectedArguments: {
      displayName: 'Customer Support',
      region: 'us',
    },
  },
  {
    prompt: 'Set SMS on Conversation app app-abc123 with service plan plan-456 and API token my-token.',
    expectedToolName: 'set-sms-channel-on-app',
    expectedArguments: {
      appId: 'app-abc123',
      servicePlanId: 'plan-456',
      apiToken: 'my-token',
    },
  },
  {
    prompt:
      'Set the RCS channel on Conversation app app-abc123 using RCS auth name my-rcs-auth and bearer token my-rcs-token.',
    expectedToolName: 'set-rcs-channel-on-app',
    expectedArguments: {
      appId: 'app-abc123',
      senderId: 'my-rcs-auth',
      bearerToken: 'my-rcs-token',
    },
  },
  {
    prompt:
      'Set the WhatsApp channel on Conversation app app-abc123 with WhatsApp sender id wa-sender-1 and bearer token wa-token-1.',
    expectedToolName: 'set-whatsapp-channel-on-app',
    expectedArguments: {
      appId: 'app-abc123',
      senderId: 'wa-sender-1',
      bearerToken: 'wa-token-1',
    },
  },
  {
    prompt: 'Rename Conversation app app-abc123 to My Support Bot.',
    expectedToolName: 'update-conversation-app',
    expectedArguments: {
      appId: 'app-abc123',
      displayName: 'My Support Bot',
    },
  },
  {
    prompt: 'Delete Conversation app app-abc123.',
    expectedToolName: 'delete-conversation-app',
    expectedArguments: {
      appId: 'app-abc123',
    },
  },
  {
    prompt: 'Show me all message templates in my account.',
    expectedToolName: 'list-messaging-templates',
    expectedArguments: undefined,
  },
  {
    prompt: 'List all webhooks for my Conversation app.',
    expectedToolName: 'list-webhooks',
    expectedArguments: undefined,
  },
  {
    prompt: 'Show me the details of webhook wh-abc123.',
    expectedToolName: 'get-webhook',
    expectedArguments: {
      webhookId: 'wh-abc123',
    },
  },
  {
    prompt: 'Create a webhook for inbound messages at https://example.com/callback with triggers MESSAGE_INBOUND.',
    expectedToolName: 'create-webhook',
    expectedArguments: {
      target: 'https://example.com/callback',
      triggers: ['MESSAGE_INBOUND'],
    },
  },
  {
    prompt: 'Remove all triggers from webhook wh-abc123.',
    expectedToolName: 'update-webhook',
    expectedArguments: {
      webhookId: 'wh-abc123',
      triggers: [],
    },
  },
  {
    prompt: 'Delete webhook wh-abc123.',
    expectedToolName: 'delete-webhook',
    expectedArguments: {
      webhookId: 'wh-abc123',
    },
  },
];

// Numbers API: search, rent, list, release, regions.
const numbersCases: ToolTestCase[] = [
  {
    prompt: 'Search for available US local numbers that can do SMS.',
    expectedToolName: 'search-for-available-numbers',
    expectedArguments: {
      regionCode: 'US',
      type: 'LOCAL',
      capabilities: ['SMS'],
    },
  },
  // Trickier wording — still search, not rent.
  {
    prompt: 'I need a US local number in area code 415',
    expectedToolName: 'search-for-available-numbers',
    expectedArguments: {
      regionCode: 'US',
      type: 'LOCAL',
      searchPattern: '415',
      patternPosition: 'START',
    },
  },
  {
    prompt: 'Can you get me a San Francisco number for SMS?',
    expectedToolName: 'search-for-available-numbers',
    expectedArguments: {
      regionCode: 'US',
      capabilities: ['SMS'],
    },
  },
  {
    prompt: 'Activate / rent this number +14155550123 for my project.',
    expectedToolName: 'rent-sinch-virtual-numbers',
    expectedArguments: {
      numbers: ['+14155550123'],
    },
  },
  {
    prompt: 'List all active rented phone numbers on my account.',
    expectedToolName: 'list-rented-numbers',
    expectedArguments: undefined,
  },
  {
    prompt: 'Release the rented phone number +14155550123 from my project.',
    expectedToolName: 'release-rented-number',
    expectedArguments: {
      phoneNumber: '+14155550123',
    },
  },
  {
    prompt: 'Which regions can I buy virtual numbers in?',
    expectedToolName: 'list-available-regions',
    expectedArguments: undefined,
  },
];

// RCS agent tools (single-turn coverage; multi-turn onboarding/evals exercise flows).
const rcsCases: ToolTestCase[] = [
  {
    prompt:
      "Create a new RCS agent named 'AcmeCorp' in the US region, with a TRANSACTIONAL use case and a conversational billing category.",
    expectedToolName: 'create-rcs-sender',
    expectedArguments: {
      region: 'US',
      useCase: 'TRANSACTIONAL',
      billingCategory: 'CONVERSATIONAL',
    },
  },
  {
    prompt: 'Get the details of RCS agent snd_abc123.',
    expectedToolName: 'get-rcs-sender',
    expectedArguments: {
      senderId: 'snd_abc123',
    },
  },
  {
    prompt: 'List all RCS agents in my project.',
    expectedToolName: 'list-rcs-senders',
    expectedArguments: undefined,
  },
  {
    prompt:
      'Update RCS agent snd_abc123 with privacy policy URL https://example.com/privacy and terms of service URL https://example.com/terms.',
    expectedToolName: 'update-rcs-sender',
    expectedArguments: {
      senderId: 'snd_abc123',
    },
  },
  {
    prompt: 'Add +3412345678900 as a test number on RCS agent snd_abc123.',
    expectedToolName: 'add-rcs-test-number',
    expectedArguments: {
      senderId: 'snd_abc123',
      testNumbers: ['+3412345678900'],
    },
  },
  {
    prompt: 'Launch RCS agent snd_abc123 now.',
    expectedToolName: 'launch-rcs-sender',
    expectedArguments: {
      senderId: 'snd_abc123',
    },
  },
  {
    prompt: 'Delete test number +3412345678900 from RCS agent snd_abc123.',
    expectedToolName: 'delete-rcs-test-number',
    expectedArguments: {
      senderId: 'snd_abc123',
      testNumber: '+3412345678900',
    },
  },
  {
    prompt: 'Resend the RCS test invite for +3412345678900 on agent snd_abc123.',
    expectedToolName: 'resend-rcs-test-number-invite',
    expectedArguments: {
      senderId: 'snd_abc123',
      testNumber: '+3412345678900',
    },
  },
  {
    prompt: 'What is the verification state of RCS test number +3412345678900 on agent snd_abc123?',
    expectedToolName: 'get-rcs-test-number-state',
    expectedArguments: {
      senderId: 'snd_abc123',
      testNumber: '+3412345678900',
    },
  },
  {
    prompt: 'Which RCS features does test number +3412345678900 support on agent snd_abc123?',
    expectedToolName: 'get-rcs-number-capabilities',
    expectedArguments: {
      senderId: 'snd_abc123',
      testNumber: '+3412345678900',
    },
  },
];

// WhatsApp provisioning templates.
const whatsappCases: ToolTestCase[] = [
  {
    prompt:
      "Create a WhatsApp template named 'order_update' in English (EN_US), category UTILITY, with body text 'Your order {{1}} has shipped.'",
    expectedToolName: 'create-whatsapp-template',
    expectedArguments: {
      name: 'order_update',
      language: 'EN_US',
      category: 'UTILITY',
    },
  },
];

// Ambiguity / sibling-tool routing — trickier wording, still a deterministic expected tool.
const ambiguityCases: ToolTestCase[] = [
  {
    prompt: 'Can +33612345678 receive RCS? Check capabilities for RCS agent snd_abc123 and test number +33612345678.',
    expectedToolName: 'get-rcs-number-capabilities',
    expectedArguments: {
      senderId: 'snd_abc123',
      testNumber: '+33612345678',
    },
  },
  {
    prompt: 'Verify +33612345678',
    expectedToolName: 'start-sms-verification',
    expectedArguments: { phoneNumber: '+33612345678' },
  },
  {
    prompt:
      "Send Antoine a WhatsApp template message using template 'appt_reminder' in Spanish with parameter name set to Mr. Smith. His number is +33612345678.",
    expectedToolName: 'send-whatsapp-template-message',
    expectedArguments: {
      recipient: '+33612345678',
      templateName: 'appt_reminder',
      templateLanguage: 'es',
    },
  },
];

// Verification & number lookup.
const verificationCases: ToolTestCase[] = [
  {
    prompt: 'Lookup for the following phone number capabilities: +33612345678',
    expectedToolName: 'number-lookup',
    expectedArguments: { phoneNumber: '+33612345678' },
  },
  {
    prompt: 'Verify the phone number +33612345678',
    expectedToolName: 'start-sms-verification',
    expectedArguments: { phoneNumber: '+33612345678' },
  },
  {
    prompt: 'Finalize the phone number +33612345678 verification with this code: 1234',
    expectedToolName: 'report-sms-verification',
    expectedArguments: {
      phoneNumber: '+33612345678',
      oneTimePassword: '1234',
    },
  },
];

// Email (Mailgun): send, templates, delivery info, events, analytics.
const emailCases: ToolTestCase[] = [
  {
    prompt: "Send an email to test@example.com saying 'Hello there!' with subject 'Hello'",
    expectedToolName: 'send-email',
    expectedArguments: {
      recipient: 'test@example.com',
      subject: 'Hello',
      body: 'Hello there!',
    },
  },
  {
    prompt: 'What email templates do I have available?',
    expectedToolName: 'list-email-templates',
    expectedArguments: undefined,
  },
  {
    prompt: 'Can you get the delivery status of the email with ID abcdef1234?',
    expectedToolName: 'retrieve-email-info',
    expectedArguments: {
      emailId: 'abcdef1234',
    },
  },
  {
    prompt: 'Show me all email activity for my account between 2025-08-18T00:00:00Z and 2025-08-21T00:00:00Z.',
    expectedToolName: 'list-email-events',
    expectedArguments: {
      beginSearchPeriod: '2025-08-18T00:00:00Z',
      endSearchPeriod: '2025-08-21T00:00:00Z',
    },
  },
  {
    prompt: 'What are the open rates between Mon, 18 Aug 2025 00:00:00 +0100 and Thu, 21 Aug 2025 00:00:00 +0100?',
    expectedToolName: 'analytics-metrics',
    expectedArguments: {
      beginSearchPeriod: 'Mon, 18 Aug 2025 00:00:00 +0100',
      endSearchPeriod: 'Thu, 21 Aug 2025 00:00:00 +0100',
    },
  },
];

// Voice: text-to-speech and conference control.
const voiceCases: ToolTestCase[] = [
  {
    prompt: "Call the phone number +33612345678 and say: 'Your appointment is tomorrow at 10 AM.'",
    expectedToolName: 'tts-callout',
    expectedArguments: {
      phoneNumber: '+33612345678',
      message: 'Your appointment is tomorrow at 10 AM.',
    },
  },
  {
    prompt: 'Call John (+33612345678) and Lisa (+34987654321) and connect them to a conference room.',
    expectedToolName: 'conference-callout',
    expectedArguments: {
      phoneNumbers: ['+33612345678', '+34987654321'],
    },
  },
  {
    prompt: 'Mute the caller xyz789 in the conference abc123.',
    expectedToolName: 'manage-conference-participant',
    expectedArguments: {
      conferenceId: 'abc123',
      participantId: 'xyz789',
      action: 'mute',
    },
  },
  {
    prompt: 'End the current conference call abc123.',
    expectedToolName: 'close-conference',
    expectedArguments: {
      conferenceId: 'abc123',
    },
  },
  {
    prompt: 'Get information about call call-xyz-789.',
    expectedToolName: 'get-call-information',
    expectedArguments: {
      callId: 'call-xyz-789',
    },
  },
];

export const toolTestCases: ToolTestCase[] = [
  ...generalCases,
  ...messagingCases,
  ...numbersCases,
  ...rcsCases,
  ...whatsappCases,
  ...verificationCases,
  ...emailCases,
  ...voiceCases,
  ...ambiguityCases,
];
