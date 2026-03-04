import { Injectable, computed, inject, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiRequest } from '../../shared/models/api-request.model';
import { HistoryItem } from '../../shared/models/history-item.model';
import { EnvironmentsService } from './environments';
import { HistoryService } from './history';
import { TabsService } from './tabs';
import { VariableResolverService } from '../utils/variable-resolver.service';
import { RunnerApiService } from '../api/runner-api.service';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {

  private readonly tabsService = inject(TabsService);
  private readonly envService = inject(EnvironmentsService);
  private readonly historyService = inject(HistoryService);
  private readonly resolver = inject(VariableResolverService);
  private readonly runner = inject(RunnerApiService);

  // ── State (derived from TabsService) ──────────────────────────────────────

  /** The request currently loaded in the active tab. */
  readonly currentRequest = computed(() => this.tabsService.activeTab()?.request ?? null);

  /**
   * The request to seed the editor with when the active tab changes.
   * Only re-evaluates when the active tab ID changes, not on every keystroke.
   */
  readonly requestToLoad = computed(() => {
    const tabId = this.tabsService.activeTabId();
    return untracked(() => {
      const req = this.tabsService.tabs().find(t => t.id === tabId)?.request;
      // Spread to always produce a new reference — guarantees the editor's
      // effect re-fires even if the tab's request object hasn't been mutated yet.
      return req ? { ...req } : null;
    });
  });

  /** The most recent response for the active tab, or null. */
  readonly response = computed(() => this.tabsService.activeTab()?.response ?? null);

  /** True while a request is in flight for the active tab. */
  readonly isLoading = computed(() => this.tabsService.activeTab()?.isLoading ?? false);

  /** Human-readable error from the last failed execution, or null. */
  readonly errorMessage = computed(() => this.tabsService.activeTab()?.errorMessage ?? null);

  // ── Mutations ─────────────────────────────────────────────────────────────

  /** Called by the editor on every request state change. */
  setRequest(request: ApiRequest): void {
    this.tabsService.updateActiveRequest(request);
  }

  /**
   * Open a saved (or new) request — creates a tab or activates an existing one.
   * The editor observes requestToLoad via an input binding.
   */
  loadRequest(request: ApiRequest): void {
    this.tabsService.openRequest(request);
  }

  /** Open a new blank tab and activate it. */
  newTab(): void {
    this.tabsService.newTab();
  }

  /**
   * After a successful save, reset the active tab's dirty flag and
   * update its savedFingerprint / label to match the persisted record.
   */
  markSaved(req: ApiRequest): void {
    const tab = untracked(() => this.tabsService.activeTab());
    if (tab) this.tabsService.markTabSaved(tab.id, req);
  }

  /**
   * Resolve variables, apply auth, proxy through the backend runner,
   * update the tab's response, and persist the result to history.
   */
  async execute(): Promise<void> {
    const tab = untracked(() => this.tabsService.activeTab());
    if (!tab || tab.isLoading) return;

    const { id: tabId, request } = tab;
    this.tabsService.setTabLoading(tabId, true);

    try {
      const envMap = this.envService.activeVarMap();
      const resolved = this.resolver.resolveForExecution(request, envMap);
      const withAuth = applyAuth(resolved);

      const response = await firstValueFrom(this.runner.execute(withAuth));
      this.tabsService.setTabResponse(tabId, response, null);

      const historyItem: HistoryItem = {
        id: crypto.randomUUID(),
        executedAt: new Date().toISOString(),
        request,
        response,
      };
      this.historyService.add(historyItem);

    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      this.tabsService.setTabResponse(tabId, null, message);
    }
  }
}

// ── Auth resolution ────────────────────────────────────────────────────────────
//
// Translates the request's auth config into concrete HTTP headers or query
// params before the payload is sent to the backend runner.
// The original request is never mutated.

function applyAuth(request: ApiRequest): ApiRequest {
  const { auth } = request;

  if (auth.type === 'bearer' && auth.bearerToken) {
    return {
      ...request,
      headers: [
        ...request.headers,
        { key: 'Authorization', value: `Bearer ${auth.bearerToken}`, enabled: true },
      ],
    };
  }

  if (auth.type === 'basic') {
    const encoded = btoa(`${auth.username ?? ''}:${auth.password ?? ''}`);
    return {
      ...request,
      headers: [
        ...request.headers,
        { key: 'Authorization', value: `Basic ${encoded}`, enabled: true },
      ],
    };
  }

  if (auth.type === 'apiKey' && auth.apiKeyKey && auth.apiKeyValue) {
    if (auth.apiKeyLocation === 'header') {
      return {
        ...request,
        headers: [
          ...request.headers,
          { key: auth.apiKeyKey, value: auth.apiKeyValue, enabled: true },
        ],
      };
    }
    return {
      ...request,
      queryParams: [
        ...request.queryParams,
        { key: auth.apiKeyKey, value: auth.apiKeyValue, enabled: true },
      ],
    };
  }

  return request;
}
