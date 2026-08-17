import { defineWorkflowEval } from './utils/workflow-eval-harness';

// Ambiguity + multi-turn: "set up a virtual number" is under-specified and
// search alone does not activate a number. The model must clarify first, then
// search, then rent a concrete E.164 — never invent digits for rent.
defineWorkflowEval({
  name: 'Virtual number support-line clarification',
  debugFirstIteration: true,
  passRate: 0.8,
  steps: [
    {
      id: 'vague-support-line',
      prompt: `Set up a virtual number for our support line.`,
      expectNoTool: true,
      responseIncludes: ['region'],
      reject: ['rent-sinch-virtual-numbers'],
    },
    {
      id: 'provide-search',
      prompt: `Search for available US local numbers that support SMS in area code 415.`,
      accept: ['search-for-available-numbers'],
      reject: ['rent-sinch-virtual-numbers'],
    },
    {
      id: 'rent-chosen-number',
      prompt: `Rent / activate +14155550123 for the project.`,
      accept: ['rent-sinch-virtual-numbers'],
    },
  ],
});
