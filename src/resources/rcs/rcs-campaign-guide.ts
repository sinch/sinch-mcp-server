export const RCS_CAMPAIGN_GUIDE_URI = 'sinch://rcs/campaign';

export const rcsCampaignGuide = `# RCS Campaign Setup Guide

## Prerequisites

Before configuring an RCS campaign you need:

- RCS must be enabled for your Sinch project. If you get a 403 \`rbm_has_not_been_used\` error, direct the user to contact si-richmessaging@sinch.com to activate it.
- A Conversation API app (existing or new) in the correct region (\`us\`, \`eu\`, or \`br\`).

Sender creation is self-serve via \`create-rcs-sender\`.

## Integration bridge

The RCS Provisioning API and the Conversation API are connected via two fields returned by the sender:
- \`authName\` → maps to \`senderId\` in \`set-rcs-channel-on-app\`
- \`authToken\` → maps to \`bearerToken\` in \`set-rcs-channel-on-app\`

Always retrieve these from \`get-rcs-sender\` before calling \`set-rcs-channel-on-app\`.

## Sender state machine

A sender progresses through these states:

\`\`\`
DRAFT → IN_PROGRESS → IN_TEST → PREPARING_LAUNCH → LAUNCHING → LAUNCHED
\`\`\`

- **DRAFT** — Sender created, configuration in progress.
- **IN_PROGRESS** — Sender being processed internally.
- **IN_TEST** — Ready for testing with test numbers via Conversation API.
- **PREPARING_LAUNCH / LAUNCHING** — Google and carrier review in progress. This is async — do not tell the user it is complete immediately.
- **LAUNCHED** — Ready for production traffic.
- **UNLAUNCHED** — Previously launched sender that has been unlaunched.
- **UNKNOWN** — Unrecognised state, treat as an error.

## Setup flow

1. **list-rcs-senders** — Check if a sender already exists in the target region and its current state.
2. **create-rcs-sender** — Provide \`region\`, \`billingCategory\` (use \`CONVERSATIONAL\` or \`NON_CONVERSATIONAL\` — BASIC_MESSAGE, CONVERSATIONAL_LEGACY and SINGLE_MESSAGE are deprecated), \`useCase\`, and brand basics.
3. **update-rcs-sender** — Fill in the launch questionnaire: \`general\` and \`verification\` sections are always required; add \`us\`, \`gb\`, or \`fr\` sections for each target country.
4. **add-rcs-test-number** — Add test phone numbers (max 20 invites/day, 200 lifetime). Wait for state to reach \`VERIFIED\`.
5. **set-rcs-channel-on-app** — Use \`authName\` and \`authToken\` from the sender to attach the RCS channel to a Conversation API app.
6. Test messaging via Conversation API with \`channel: RCS\` on test numbers.
7. **launch-rcs-sender** — Begin the launch process. Monitor \`countryStatus[]\` per operator for approval — this is async and not instant.
8. Once \`LAUNCHED\`, reconnect \`set-rcs-channel-on-app\` on the production app if needed.

## Questionnaire requirements before launch

Incomplete questionnaires will cause launch rejection. Required sections per target:

- **Always required**: \`general\` (opt-in description, opt-out description, trigger description, screenshot URIs, video URIs) and \`verification\` (contact name, email, title, website).
- **UK targets**: \`gb\` section — brand industry, company legal name, company registration number, full company address, messages volume, messages frequency, campaign length.
- **France targets**: \`fr\` section — full company address, SIREN number.
- **US targets**: \`us\` section — ~25 fields including EIN or tax ID, brand name, legal form, address, contact details, use-case description, sample messages, opt-in/opt-out flows, and Verizon-specific fields if applicable.

Collect all required answers from the user **before** calling create or update.

## Test number limits

- 20 invite requests per day (hard cap — returns 429 if exceeded).
- 200 total invites per sender (lifetime cap).
- Each test number state: PENDING → VERIFIED (once the tester accepts the invite).
- Other possible states: DECLINED, REJECTED, INVALID, UNVERIFIED — if any of these occur, delete the test number and re-add it or use \`resend-rcs-test-number-invite\`.
- Use \`resend-rcs-test-number-invite\` if the tester did not receive the invite.

## Message types for RCS campaigns

| Goal | Tool | Key parameters |
|------|------|----------------|
| Plain text | \`send-text-message\` | \`channel: RCS\`, \`recipient\`, \`message\` |
| Image or video | \`send-media-message\` | \`channel: RCS\`, \`recipient\`, \`url\` |
| Interactive choices | \`send-choice-message\` | \`channel: RCS\`, \`text\`, \`choiceContent\` |
| Pre-approved template | \`send-template-message\` | \`channel: RCS\`, \`templateId\`, \`language\` (BCP-47, optional), \`parameters\` (key-value map, optional) |

Always pass \`channel: RCS\` explicitly.

## Ambiguous prompts

If the user says "set up an RCS campaign" without enough context, ask:

1. Do you have an existing RCS sender or do you need to create one?
2. Which region — US, EU, or Brazil?
3. What type of content — plain text, image/video, interactive choices, or a template?

## Common errors

- **403 rbm_has_not_been_used** — RCS has not been enabled for this project. Direct the user to contact si-richmessaging@sinch.com.
- **429 rbm_too_many_requests** — Test number invite daily cap hit. Wait 24 hours before retrying.
- **401 unauthorized_error** — Invalid credentials or wrong project ID. Verify the project ID and credentials.
- **Region mismatch** — Sender region and Conversation API app region must be identical. Re-check both before calling \`set-rcs-channel-on-app\`.
`;
