import { defineWorkflowSuite } from './utils/workflow-harness';

const TEMPLATE_NAME = 'appt_reminder';

// Stops before delete — that's covered by whatsapp-template-delete-confirmation.eval.test.ts instead.
defineWorkflowSuite({
  name: 'WhatsApp template lifecycle',
  steps: [
    {
      id: 'create-template-en',
      prompt: `Create a WhatsApp utility template named '${TEMPLATE_NAME}' in English with a body: "Your appointment is on {{1}}."`,
      accept: ['create-whatsapp-template'],
    },
    {
      id: 'create-template-es',
      prompt: `Also create a Spanish (ES) version of that same '${TEMPLATE_NAME}' template, with the same body text.`,
      accept: ['create-whatsapp-template'],
    },
    {
      id: 'list-templates',
      prompt: `What WhatsApp templates do I have now?`,
      accept: ['list-messaging-templates'],
    },
    {
      id: 'send-message',
      prompt: `Send the English version of that ${TEMPLATE_NAME} template to +33612345678 on WhatsApp, filling body variable 1 with '2026-08-10'.`,
      accept: ['send-whatsapp-template-message'],
    },
    {
      id: 'update-template',
      prompt: `Change the English ${TEMPLATE_NAME} template's category to MARKETING.`,
      accept: ['update-whatsapp-template'],
    },
  ],
});
