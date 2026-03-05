import { ApiRequest, HttpMethod } from './api-request.model';
import { ApiResponse } from './api-response.model';
import { AssertionSummary } from './assertion.model';

/**
 * Represents one open tab in the editor strip.
 * Tabs are ephemeral — they live in-memory only and are not persisted to Dexie.
 */
export interface WorkspaceTab {
  /** Unique tab instance id. */
  id: string;
  /** The saved request id this tab is linked to. Null for unsaved drafts. */
  requestId: string | null;
  /** Label shown in the tab strip. */
  label: string;
  /** HTTP method — used for color-coding the tab. */
  method: HttpMethod;
  /** True when the editor state differs from the last saved/opened version. */
  isDirty: boolean;
  /** Current editable request snapshot — updated on every editor keystroke. */
  request: ApiRequest;
  /**
   * Fingerprint of the clean/saved version of the request.
   * Used to compute isDirty without deep-comparing every field.
   */
  savedFingerprint: string;
  /** Last response received for this tab, or null. */
  response: ApiResponse | null;
  /** True while a request is in-flight for this tab. */
  isLoading: boolean;
  /** Human-readable error from the last failed execution, or null. */
  errorMessage: string | null;
  /** Assertion results from the last execution, or null before any run. */
  assertionSummary: AssertionSummary | null;
}
