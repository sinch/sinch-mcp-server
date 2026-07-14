import { defineWorkflowEval } from './utils/workflow-eval-harness';

// Text-only recovery eval: the model is asked to message someone by name with
// no phone number available anywhere in context. It must ask a clarifying
// question (no tool call) instead of guessing a number, then call the tool
// once the user supplies it in E.164 format.
defineWorkflowEval({
  name: 'Send message clarification',
  debugFirstIteration: true,
  passRate: 0.8,
  steps: [
    {
      id: 'ambiguous-send',
      prompt: `Send a message to Antoine to say Hi`,
      expectNoTool: true,
    },
    {
      id: 'provide-number',
      prompt: `+12025550123 and SMS messaging chanel`,
      accept: ['send-text-message'],
    },
  ],
});
