export const RCS_CAMPAIGN_GUIDE_URI = 'sinch://rcs/campaign';

export const rcsCampaignGuide = `# RCS Campaign Setup Guide

## Prerequisites

Before configuring an RCS campaign you need:

- RCS must be enabled for your Sinch project. If you get a 403 \`rbm_has_not_been_used\` error, direct the user to contact si-richmessaging@sinch.com to activate it.
- A Conversation API app in the target region (\`us\`, \`eu\`, or \`br\`). Always call \`list-conversation-apps\` first — use an existing app if one is available in the right region before calling \`create-conversation-app\`.

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
- **PENDING_LAUNCH** — Launch triggered but no video URI was provided in the questionnaire. A video will be added by Sinch Service Implementation before continuing.
- **PREPARING_LAUNCH / LAUNCHING** — Google and carrier review in progress. This is async — do not tell the user it is complete immediately.
- **LAUNCHED** — Ready for production traffic.
- **UNLAUNCHED** — Previously launched sender that has been unlaunched.
- **UNKNOWN** — Unrecognised state, treat as an error.

## Setup flow

There are two variants depending on whether all information is available upfront.

### Variant A — Single-shot (all details provided at creation)

Use when the user has all brand details, questionnaire answers, countries, and test numbers ready.

1. **list-rcs-senders** — Check if a sender already exists in the target region.
2. **create-rcs-sender** — Provide \`region\`, \`billingCategory\`, \`useCase\`, and the full \`details\` object (brand, questionnaire, countries, testNumbers) in one call. If complete, sender lands directly in \`IN_TEST\`.
3. **set-rcs-channel-on-app** — Use \`authName\` and \`authToken\` from the created sender.
4. Test messaging via Conversation API with \`channel: RCS\` on test numbers.
5. **launch-rcs-sender** — No request body. Check launch requirements first (see below).
6. Once \`LAUNCHED\`, reconnect \`set-rcs-channel-on-app\` on the production app if needed.

### Variant B — Incremental (details filled progressively)

Use when the user does not have all information ready at creation time.

1. **list-rcs-senders** — Check if a sender already exists in the target region.
2. **create-rcs-sender** — Required only: \`region\`, \`billingCategory\`, \`useCase\`. Sender starts in \`DRAFT\`.
3. **update-rcs-sender** — Fill brand details, questionnaire sections, and countries via one or more PATCH calls. Pass \`null\` for \`testNumbers\` or \`countries\` to delete those values.
4. **add-test-numbers-to-rcs-sender** — Accepts an array of E.164 numbers (max 200 total, 20 invites/day).
5. **set-rcs-channel-on-app** — Use \`authName\` and \`authToken\` from the sender.
6. Test messaging via Conversation API with \`channel: RCS\` on test numbers.
7. **launch-rcs-sender** — No request body. Check launch requirements first (see below).
8. Once \`LAUNCHED\`, reconnect \`set-rcs-channel-on-app\` on the production app if needed.

## Launch requirements (all must be met or 412 is returned)

- Questionnaire completed.
- \`details.countries\` has at least 1 value.
- At least one \`details.brand.phones\` OR \`details.brand.emails\` (both recommended).
- \`details.brand.bannerUrl\` defined.
- \`details.brand.logoUrl\` defined.
- \`details.brand.privacyPolicyUrl\` defined.
- \`details.brand.termsOfServiceUrl\` defined.

If \`videoUris\` was not provided in the questionnaire, the sender enters \`PENDING_LAUNCH\` — not a failure. Sinch Service Implementation will add a video before the review continues.

## Questionnaire requirements

Required sections for all senders:
- **general**: optInDescription, optOutDescription, triggerDescription, interactionsDescription, screenshotUris, videoUris.
- **verification**: contact name, email, title, website.

Country-specific sections:
- **UK targets** (\`gb\`): brandIndustry, companyLegalName, companyRegistrationNumber, fullCompanyAddress, messagesVolume, messagesFrequency, campaignLength.
- **France targets** (\`fr\`): fullCompanyAddress, SIREN number.
- **US targets** (\`us\`): ~25 fields including EIN or tax ID, brandName, legalForm, full address, contact details, useCaseDescription, sampleMessages, callToActionDescription, callToActionScreenshotUrl, opt-in/opt-out flows, and Verizon-specific fields if applicable.

## Test numbers

Before adding test numbers, call \`get-rcs-sender\` and check the existing \`testNumberStates[]\`. If the number is already \`VERIFIED\`, do not re-add it — re-adding resets it to \`UNVERIFIED\` and triggers a new invite. Only add numbers that are not already present or need to be re-invited.

- \`add-test-numbers-to-rcs-sender\` accepts an array of E.164 numbers.
- 20 invites per day (hard cap — returns 429 if exceeded), 200 total per sender.
- States: PENDING → VERIFIED (accepted), or DECLINED, REJECTED, INVALID, UNVERIFIED, UNRECOGNIZED.
- Re-adding a VERIFIED number resets it to UNVERIFIED and re-sends the invite.
- Use \`retry-rcs-test-number-invite\` (\`GET .../retry\`) to resend an invite — also resets VERIFIED to UNVERIFIED.
- Use \`delete-rcs-test-number\` to remove a number (returns 204 No Content).

## Verifying the Conversation API channel connection

Before calling \`set-rcs-channel-on-app\`, retrieve the sender via \`get-rcs-sender\` and check \`conversationApiAppDetails.channelStatus\`. If it is already \`ACTIVE\`, the channel is connected — skip \`set-rcs-channel-on-app\` and proceed directly to test messaging.

If the channel is not yet connected or needs updating, call \`set-rcs-channel-on-app\` and then check \`channelStatus\` again:

- **ACTIVE** — Channel is connected and ready. Proceed to test messaging.
- **PENDING** — Connection in progress. Wait and check again before testing.
- **FAILING** — Credentials rejected. \`authName\` or \`authToken\` may be wrong or stale. Retrieve fresh values and retry \`set-rcs-channel-on-app\`.
- **UNRECOGNIZED** — Unexpected state, treat as an error.

Do not proceed to test messaging until \`channelStatus\` is \`ACTIVE\`.

## Monitoring launch progress

After calling \`launch-rcs-sender\`, the process is async. To track progress:

- **\`get-rcs-sender\`** — Check \`state\` (LAUNCHING → LAUNCHED) and \`countryStatus[]\` per country and operator. Each entry has a \`status\` (LAUNCHED, PENDING, REJECTED, SUSPENDED, etc.) and an optional \`remark\`.
- **\`list-rcs-sender-activities\`** — Paginated audit log ordered newest first. Activity types: ACTIVE, COMMENT_ADDED, CREATED, DELETED, EDITED, INACTIVE, TEST. Use this when the user asks "what is happening with my sender?" or "why is it stuck?".

Do not tell the user the launch is complete until \`state\` is \`LAUNCHED\`.

## Supported countries for launch

\`details.countries\` on update accepts only a specific set of supported countries, not all ISO 3166 codes. Supported values include: AT, BE, BR, CA, CZ, DK, FI, FR, DE, GR, HU, IT, MX, NL, NO, PE, PL, PT, SG, SK, ES, SE, US, GB.

If the user requests a country outside this list, inform them it is not currently supported for RCS launch.

## Number capabilities

\`get-rcs-test-number-capabilities\` returns the RCS features supported by that specific test number's device, for example:
- ACTION_DIAL, ACTION_OPEN_URL, ACTION_SHARE_LOCATION, ACTION_VIEW_LOCATION
- RICHCARD_CAROUSEL, RICHCARD_STANDALONE
- REVOCATION

Use this to verify the device can handle the message type you plan to send before testing.

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

- **403 rbm_has_not_been_used** — RCS not enabled for this project. Contact si-richmessaging@sinch.com.
- **409 Conflict** — Sender already exists or is in a conflicting state.
- **412 Precondition Failed** — Launch requirements not met. Check the launch requirements checklist above.
- **429 rbm_too_many_requests** — Test number invite daily cap hit. Wait 24 hours.
- **401 unauthorized_error** — Invalid credentials or wrong project ID.
- **Region mismatch** — Sender region and Conversation API app region must be identical.
`;
