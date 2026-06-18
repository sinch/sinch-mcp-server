export const RCS_SETUP_URI = 'sinch://rcs/setup-guide';

export const rcsSetupGuide = `# RCS sender setup and workflows

## Overview

RCS provisioning uses the Sinch Provisioning API. Conversation API messaging uses separate tools after the sender is connected.

For full Conversation API app setup (channels), see resource \`sinch://conversation/app-setup\`.

## Typical flow — new sender from scratch

1. **create-rcs-sender** — \`region\`, \`billingCategory\`, \`useCase\`. Optionally include full \`details\` (brand, questionnaire, countries) in one call.
2. **update-rcs-sender** — Fill or update any sender fields in one PATCH if not done at create.
3. **add-rcs-test-number** — Invite testers (max 20/day, 200 total).
4. **get-rcs-test-number-states** — Poll until \`VERIFIED\`. Use **resend-rcs-test-number-invite** if \`PENDING\` or \`UNVERIFIED\`.
5. **get-rcs-number-capabilities** — Optional; check device features before testing message types.
6. **get-rcs-sender** — Read \`authName\` and \`authToken\`.
7. **set-rcs-channel-on-app** — \`appId\`, \`senderId=authName\`, \`bearerToken=authToken\`.
8. **send-text-message** / **send-choice-message** / **send-media-message** — \`channel: ['RCS']\`, only to verified test numbers.
9. **launch-rcs-sender** — Submit for Google + carrier review.
10. Monitor \`countryStatus\` via **get-rcs-sender** until \`LAUNCHED\`.

## Existing sender

- **list-rcs-senders** → find by region/state
- \`DRAFT\` → **update-rcs-sender**
- \`IN_TEST\` → steps 6–8
- \`LAUNCHED\` → reconnect **set-rcs-channel-on-app** on production app
- \`PENDING_LAUNCH\` / \`LAUNCHING\` → monitor **get-rcs-sender** \`countryStatus\`

## Test number troubleshooting

| State | Action |
|-------|--------|
| PENDING | Wait or **resend-rcs-test-number-invite** |
| UNVERIFIED | **resend-rcs-test-number-invite** |
| DECLINED / REJECTED / INVALID | **delete-rcs-test-number**, then **add-rcs-test-number** |
| VERIFIED | **get-rcs-number-capabilities**, then test messaging |

## Capabilities → message type

| Feature | Tool |
|---------|------|
| RICHCARD_CAROUSEL | send-choice-message |
| RICHCARD_STANDALONE | send-media-message |
| ACTION_DIAL | send-choice-message with call action |
| basic only | send-text-message |

## Common errors

| Error | Cause | Action |
|-------|-------|--------|
| 403 rbm_has_not_been_used | RCS not enabled | Contact si-richmessaging@sinch.com |
| 409 | Sender exists | **list-rcs-senders** + **get-rcs-sender** |
| 412 | Launch checklist incomplete | Complete questionnaire, countries, brand assets |
| 429 | Invite cap | Wait 24h |
| 401 | Wrong credentials | Verify PROJECT_ID, KEY_ID, KEY_SECRET |
`;
