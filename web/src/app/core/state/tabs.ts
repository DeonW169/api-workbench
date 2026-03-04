import { Injectable, computed, signal } from '@angular/core';
import { ApiRequest } from '../../shared/models/api-request.model';
import { ApiResponse } from '../../shared/models/api-response.model';
import { WorkspaceTab } from '../../shared/models/workspace-tab.model';

@Injectable({ providedIn: 'root' })
export class TabsService {
  private readonly _initial = createBlankTab();

  readonly tabs = signal<WorkspaceTab[]>([this._initial]);
  readonly activeTabId = signal<string>(this._initial.id);

  readonly activeTab = computed(
    () => this.tabs().find(t => t.id === this.activeTabId()) ?? null,
  );

  // ── Open ──────────────────────────────────────────────────────────────────

  /**
   * Open a saved request in the tab strip.
   * If a tab for this request is already open, activates it instead of opening a duplicate.
   */
  openRequest(req: ApiRequest): void {
    const existing = this.tabs().find(t => t.requestId === req.id);
    if (existing) {
      this.activeTabId.set(existing.id);
      return;
    }
    const tab = reqToTab(req);
    this.tabs.update(tabs => [...tabs, tab]);
    this.activeTabId.set(tab.id);
  }

  /** Open a new blank unsaved tab and activate it. */
  newTab(): WorkspaceTab {
    const tab = createBlankTab();
    this.tabs.update(tabs => [...tabs, tab]);
    this.activeTabId.set(tab.id);
    return tab;
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  activateTab(id: string): void {
    this.activeTabId.set(id);
  }

  closeTab(id: string): void {
    const tabs = this.tabs();
    const idx = tabs.findIndex(t => t.id === id);
    if (idx === -1) return;

    const remaining = tabs.filter(t => t.id !== id);

    // Always keep at least one tab open
    if (!remaining.length) {
      const blank = createBlankTab();
      this.tabs.set([blank]);
      this.activeTabId.set(blank.id);
      return;
    }

    this.tabs.set(remaining);

    if (this.activeTabId() === id) {
      // Activate the tab to the left, falling back to the first remaining
      this.activeTabId.set(remaining[Math.max(0, idx - 1)].id);
    }
  }

  closeOtherTabs(id: string): void {
    const tab = this.tabs().find(t => t.id === id);
    if (!tab) return;
    this.tabs.set([tab]);
    this.activeTabId.set(id);
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  /**
   * Update the active tab's request snapshot.
   * Called on every editor keystroke via workspace.setRequest().
   * Recomputes isDirty by comparing the fingerprint to the saved version.
   */
  updateActiveRequest(req: ApiRequest): void {
    const activeId = this.activeTabId();
    this.tabs.update(tabs =>
      tabs.map(t => {
        if (t.id !== activeId) return t;
        const dirty = t.requestId !== null && fingerprint(req) !== t.savedFingerprint;
        return { ...t, request: req, label: req.name, method: req.method, isDirty: dirty };
      }),
    );
  }

  setTabLoading(id: string, loading: boolean): void {
    this.tabs.update(tabs =>
      tabs.map(t =>
        t.id === id ? { ...t, isLoading: loading, errorMessage: loading ? null : t.errorMessage } : t,
      ),
    );
  }

  setTabResponse(id: string, response: ApiResponse | null, errorMessage: string | null): void {
    this.tabs.update(tabs =>
      tabs.map(t =>
        t.id === id ? { ...t, response, errorMessage, isLoading: false } : t,
      ),
    );
  }

  /**
   * Mark a tab as saved: reset isDirty, update the savedFingerprint and label.
   * Also patches the tab's request.name to stay in sync with the saved name.
   */
  markTabSaved(tabId: string, savedReq: ApiRequest): void {
    const fp = fingerprint(savedReq);
    this.tabs.update(tabs =>
      tabs.map(t =>
        t.id === tabId
          ? {
              ...t,
              requestId: savedReq.id,
              label: savedReq.name,
              method: savedReq.method,
              savedFingerprint: fp,
              isDirty: false,
              request: { ...t.request, name: savedReq.name },
            }
          : t,
      ),
    );
  }
}

// ── Factory helpers ───────────────────────────────────────────────────────────

function createBlankTab(): WorkspaceTab {
  const now = new Date().toISOString();
  const request: ApiRequest = {
    id: crypto.randomUUID(),
    name: 'New Request',
    method: 'GET',
    url: '',
    queryParams: [],
    headers: [],
    bodyType: 'none',
    bodyRaw: '',
    bodyFormFields: [],
    auth: { type: 'none' },
    variables: [],
    createdAt: now,
    updatedAt: now,
  };
  return {
    id: crypto.randomUUID(),
    requestId: null,
    label: 'New Request',
    method: 'GET',
    isDirty: false,
    request,
    savedFingerprint: fingerprint(request),
    response: null,
    isLoading: false,
    errorMessage: null,
  };
}

function reqToTab(req: ApiRequest): WorkspaceTab {
  return {
    id: crypto.randomUUID(),
    requestId: req.id,
    label: req.name,
    method: req.method,
    isDirty: false,
    request: req,
    savedFingerprint: fingerprint(req),
    response: null,
    isLoading: false,
    errorMessage: null,
  };
}

/**
 * Semantic fingerprint for dirty detection.
 * Excludes id, name, timestamps, and collection metadata —
 * only the HTTP request content matters for dirty state.
 */
function fingerprint(req: ApiRequest): string {
  return JSON.stringify({
    method: req.method,
    url: req.url,
    queryParams: req.queryParams,
    headers: req.headers,
    bodyType: req.bodyType,
    bodyRaw: req.bodyRaw,
    bodyFormFields: req.bodyFormFields ?? [],
    auth: req.auth,
  });
}
