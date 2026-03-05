import { ApiRequest } from './api-request.model';
import { ApiResponse } from './api-response.model';
import { AssertionSummary } from './assertion.model';

// ── Options ───────────────────────────────────────────────────────────────────

export interface CollectionRunOptions {
  /** Stop the run immediately after any request fails or any assertion fails. */
  stopOnFailure: boolean;
  /** Milliseconds to wait between consecutive requests. 0 = no delay. */
  delayMs: number;
}

export const DEFAULT_RUN_OPTIONS: CollectionRunOptions = {
  stopOnFailure: false,
  delayMs: 0,
};

// ── Scope ─────────────────────────────────────────────────────────────────────

/** Defines the set of requests to run. */
export interface CollectionRunScope {
  /** The parent collection — used for collection-level variable resolution. */
  collectionId: string;
  /**
   * When set, only requests belonging to this folder are run.
   * When omitted, all requests in the collection are run across all folders.
   */
  folderId?: string;
}

// ── Per-request result ────────────────────────────────────────────────────────

export interface CollectionRunItem {
  /** The original (un-resolved) request as authored by the user. */
  request: ApiRequest;
  /** HTTP response, or null if the network request failed. */
  response: ApiResponse | null;
  /**
   * Assertion evaluation results; null when no assertions are configured
   * for this request.
   */
  assertionSummary: AssertionSummary | null;
  /**
   * Overall pass/fail for this item:
   *   - If assertions are configured: passes only when all assertions pass.
   *   - If no assertions: passes when the HTTP response is 2xx (response.ok).
   */
  passed: boolean;
  /** Human-readable error if the HTTP request itself failed; null otherwise. */
  error: string | null;
  /** Wall-clock duration in ms (taken from the response; 0 on network error). */
  durationMs: number;
}

// ── Run-level summary ─────────────────────────────────────────────────────────

export interface CollectionRunSummary {
  /** Total number of requests in scope (including skipped). */
  totalRequests: number;
  /** Number of requests that passed. */
  passed: number;
  /** Number of requests that failed. */
  failed: number;
  /** Requests not attempted because stopOnFailure was triggered. */
  skipped: number;
  /** Sum of durationMs across all attempted requests. */
  totalDurationMs: number;
  /** All attempted results in execution order. */
  items: CollectionRunItem[];
  /** True if the run ended early because stopOnFailure was triggered. */
  stoppedEarly: boolean;
}

// ── Observable events ─────────────────────────────────────────────────────────

/**
 * Discriminated-union of events emitted by CollectionRunnerService.run().
 * Consumers subscribe to receive real-time progress as each request executes.
 */
export type CollectionRunEvent =
  | {
      type: 'start';
      /** 0-based index of the request about to be sent. */
      index: number;
      total: number;
      request: ApiRequest;
    }
  | {
      type: 'result';
      index: number;
      item: CollectionRunItem;
    }
  | {
      type: 'complete';
      summary: CollectionRunSummary;
    };
