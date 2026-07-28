import { defineWorkflowEval } from './utils/workflow-eval-harness';

// Under-specified Numbers request: "support line" has no E.164 number — not
// enough to rent. Clarify OR search is fine; rent with invented digits is not.
defineWorkflowEval({
  name: 'Virtual number support-line clarification',
  debugFirstIteration: true,
  passRate: 0.8,
  steps: [
    {
      id: 'vague-support-line',
      prompt: `Set up a virtual number for our support line.`,
      accept: ['search-for-available-numbers'],
      allowNoTool: true,
      reject: ['rent-sinch-virtual-numbers'],
    },
    {
      id: 'provide-search',
      prompt: `Search for available US local numbers that support SMS in area code 415.`,
      accept: ['search-for-available-numbers'],
      reject: ['rent-sinch-virtual-numbers'],
    },
  ],
});
