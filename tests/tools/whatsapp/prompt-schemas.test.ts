import { WhatsAppTemplateDetails } from '../../../src/tools/whatsapp/prompt-schemas';

const bodyComponent = { type: 'BODY' as const, text: 'Hello' };

describe('WhatsAppTemplateDetails buttons validation', () => {
  test('allows two FLOW buttons as long as their type/text combination is unique', () => {
    const result = WhatsAppTemplateDetails.safeParse({
      components: [
        bodyComponent,
        {
          type: 'BUTTONS',
          buttons: [
            { type: 'FLOW', text: 'Start', flowId: 'flow-1' },
            { type: 'FLOW', text: 'Restart', flowId: 'flow-2' },
          ],
        },
      ],
    });

    expect(result.success).toBeTrue();
  });

  test('rejects two REQUEST_CONTACT_INFO buttons (identical type/text combination)', () => {
    const result = WhatsAppTemplateDetails.safeParse({
      components: [
        bodyComponent,
        {
          type: 'BUTTONS',
          buttons: [{ type: 'REQUEST_CONTACT_INFO' }, { type: 'REQUEST_CONTACT_INFO' }],
        },
      ],
    });

    expect(result.success).toBeFalse();
  });

  test('allows multiple URL buttons as long as their type/text combination is unique', () => {
    const result = WhatsAppTemplateDetails.safeParse({
      components: [
        bodyComponent,
        {
          type: 'BUTTONS',
          buttons: [
            { type: 'URL', text: 'Visit A', url: 'https://a.example.com' },
            { type: 'URL', text: 'Visit B', url: 'https://b.example.com' },
          ],
        },
      ],
    });

    expect(result.success).toBeTrue();
  });

  test('rejects two URL buttons with the same text', () => {
    const result = WhatsAppTemplateDetails.safeParse({
      components: [
        bodyComponent,
        {
          type: 'BUTTONS',
          buttons: [
            { type: 'URL', text: 'Visit', url: 'https://a.example.com' },
            { type: 'URL', text: 'Visit', url: 'https://b.example.com' },
          ],
        },
      ],
    });

    expect(result.success).toBeFalse();
  });
});
