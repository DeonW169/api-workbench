// ── Assertion definitions (discriminated union) ───────────────────────────────

interface AssertionBase {
  /** Stable UUID for tracking across edits. */
  id: string;
  /** When false the assertion is skipped during evaluation. */
  enabled: boolean;
  /** Optional human label shown in the UI instead of the auto-generated one. */
  label?: string;
}

export type Assertion = AssertionBase &
  (
    | { type: 'statusEquals';   expected: number }
    | { type: 'bodyContains';   substring: string }
    | { type: 'headerExists';   header: string }
    | { type: 'jsonPathExists'; path: string }
    | { type: 'jsonPathEquals'; path: string; expected: string }
  );

export type AssertionType = Assertion['type'];

/** All supported assertion types in display order. */
export const ASSERTION_TYPES: AssertionType[] = [
  'statusEquals',
  'bodyContains',
  'headerExists',
  'jsonPathExists',
  'jsonPathEquals',
];

// ── Assertion results ─────────────────────────────────────────────────────────

export interface AssertionResult {
  /** The assertion that was evaluated. */
  assertion: Assertion;
  passed: boolean;
  /** Short human-readable outcome, e.g. "Expected status 200, got 404". */
  message: string;
  /** The actual value extracted during evaluation, for debug display. */
  actual?: unknown;
}

export interface AssertionSummary {
  results: AssertionResult[];
  /** Number of enabled assertions that passed. */
  passed: number;
  /** Number of enabled assertions that failed. */
  failed: number;
  /** Total number of enabled assertions evaluated. */
  total: number;
}
