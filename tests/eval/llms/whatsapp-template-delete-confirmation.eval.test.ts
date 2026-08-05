import { defineWorkflowEval } from './utils/workflow-eval-harness';

// Checks the model waits for explicit confirmation before deleting, scopes a
// single-language delete correctly when another language variant exists, and
// switches to the bulk (by-name) tool only when asked to remove everything.
defineWorkflowEval({
  name: 'WhatsApp template delete confirmation',
  // Composite pass rate over 7 ANDed steps, so it's bottlenecked by the two
  // weakest links: confirm-delete-one (25-47% across calibration runs — worse
  // than the plain single-delete case, since the model also has to keep the
  // "leave Spanish untouched" scoping straight) and create-es (63-67%, for
  // reasons not yet diagnosed). Observed composite: 12.5% (n=8), 27% (n=15).
  passRate: 0.15,
  steps: [
    {
      id: 'create-en',
      prompt: `Create a WhatsApp UTILITY template named 'appt_reminder' in English with a body: 'Your appointment is on {{1}}.'`,
      accept: ['create-whatsapp-template'],
    },
    {
      id: 'create-es',
      prompt: `Also create a Spanish (ES) version of that same 'appt_reminder' template, with the same body text.`,
      accept: ['create-whatsapp-template'],
    },
    {
      id: 'delete-one-request',
      prompt: `Delete the WhatsApp template named 'appt_reminder' in English.`,
      expectNoTool: true,
    },
    {
      id: 'confirm-delete-one',
      // Answers deleteSubmitted too — leaving it open gets a second question instead of the tool call.
      prompt: `Yes, I confirm — delete 'appt_reminder' (English) only, draft only, not the submitted version. Leave the Spanish version untouched.`,
      accept: ['delete-single-whatsapp-template-variant'],
    },
    {
      id: 'verify-remaining',
      prompt: `What WhatsApp templates named 'appt_reminder' do I have left?`,
      accept: ['list-messaging-templates'],
    },
    {
      id: 'bulk-delete-request',
      prompt: `Now get rid of 'appt_reminder' completely — I don't need any language version of it anymore.`,
      expectNoTool: true,
    },
    {
      id: 'confirm-bulk-delete',
      prompt: `Yes, I confirm — delete every remaining language variant of 'appt_reminder' entirely.`,
      accept: ['delete-all-whatsapp-template-variants'],
    },
  ],
});
