import { defineWorkflowSuite } from './utils/workflow-harness';

const AGENT_NAME = 'SergioTestCorp';

// Multi-turn RCS onboarding: create → status → brand → regulatory → SMS
// fallback → countries → tester → launch. See utils/workflow-harness.ts for the
// authoring standard.
defineWorkflowSuite({
  name: 'RCS onboarding',
  steps: [
    {
      id: 'create-sender',
      prompt: `Create a new RCS agent (sender) named '${AGENT_NAME}' in the US region, with a TRANSACTIONAL use case and a conversational billing category.`,
      accept: ['create-rcs-sender'],
    },
    {
      id: 'check-status',
      prompt: `What is the status of the '${AGENT_NAME}' RCS agent?`,
      accept: ['get-rcs-sender', 'list-rcs-senders'],
    },
    {
      id: 'brand-assets',
      prompt: `Here is the logo URL (https://cdn.example.com/logo.png) and our Privacy Policy link (https://example.com/privacy) for the ${AGENT_NAME} agent.`,
      accept: ['update-rcs-sender'],
    },
    {
      id: 'regulatory-us',
      prompt: `Let's fill out the regulatory info for the US market on that sender (the brand operates in the US, primary website https://example.com).`,
      accept: ['update-rcs-sender'],
    },
    {
      id: 'sms-fallback',
      prompt: `Set the SMS channel on Conversation app 'app-xyz' using SMS service plan id 'plan-123' and API token 'tok-abc' (our short code for SMS fallback).`,
      accept: ['set-sms-channel-on-app'],
    },
    {
      id: 'target-countries',
      prompt: `Add the UK and France to our target countries for the ${AGENT_NAME} sender.`,
      accept: ['update-rcs-sender'],
    },
    {
      id: 'add-tester',
      prompt: `Add +3412345678900 as a tester.`,
      accept: ['add-rcs-test-number'],
    },
    {
      id: 'launch',
      prompt: `Everything is set, launch the ${AGENT_NAME} sender.`,
      accept: ['launch-rcs-sender'],
    },
  ],
});
