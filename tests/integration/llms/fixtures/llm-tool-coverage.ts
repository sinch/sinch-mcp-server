import { toolTestCases, ToolTestCase } from './tool-cases';

/** Collect tool names covered by single-turn LLM fixtures (`expectedToolName` / `accept`). */
export const collectCoveredToolsFromCases = (cases: ToolTestCase[]): Set<string> =>
  new Set(
    cases.flatMap((testCase) => [
      ...(testCase.expectedToolName ? [testCase.expectedToolName] : []),
      ...(testCase.accept ?? []),
    ]),
  );

/** Tool names exercised by LLM fixtures (derived from tool-cases only — no hand-maintained list). */
export const collectFixtureCoveredTools = (): Set<string> => collectCoveredToolsFromCases(toolTestCases);
