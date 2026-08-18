import { defineWorkflowEval } from './utils/workflow-eval-harness';

const AGENT_NAME = 'StatusWordingCorp';

// Confirms "status" wording maps to `state` via the existing get/list tools.
defineWorkflowEval({
  name: 'RCS agent status wording',
  // Calibrated from a 10-iteration run against openai/gpt-5-mini: 10/10 (100%).
  passRate: 0.9,
  steps: [
    {
      id: 'create-sender',
      prompt: `Create a new RCS agent named '${AGENT_NAME}' in the US region, with a TRANSACTIONAL use case and a conversational billing category.`,
      accept: ['create-rcs-sender'],
    },
    {
      id: 'single-status',
      prompt: `What's the current status of the ${AGENT_NAME} RCS agent?`,
      accept: ['get-rcs-sender'],
      responseIncludes: ['draft'],
    },
    {
      id: 'bulk-status',
      prompt: `Can you check the statuses of all my RCS agents?`,
      accept: ['list-rcs-senders'],
      responseIncludes: ['draft'],
    },
  ],
});
