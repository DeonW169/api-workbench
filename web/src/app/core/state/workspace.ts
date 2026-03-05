import { Injectable, computed, inject, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiRequest } from '../../shared/models/api-request.model';
import { HistoryItem } from '../../shared/models/history-item.model';
import { CollectionsService } from './collections';
import { EnvironmentsService } from './environments';
import { GlobalsService } from './globals';
import { HistoryService } from './history';
import { TabsService } from './tabs';
import { VariableResolverService, buildVarMap } from '../utils/variable-resolver.service';
import { AssertionService } from '../utils/assertion.service';
import { RunnerApiService } from '../api/runner-api.service';
import { applyAuth } from '../utils/auth';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {

  private readonly tabsService = inject(TabsService);
  private readonly collectionsService = inject(CollectionsService);
  private readonly envService = inject(EnvironmentsService);
  private readonly globalsService = inject(GlobalsService);
  private readonly historyService = inject(HistoryService);
  private readonly resolver = inject(VariableResolverService);
  private readonly assertionService = inject(AssertionService);
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

  /** Assertion results from the last execution for the active tab, or null. */
  readonly assertionSummary = computed(() => this.tabsService.activeTab()?.assertionSummary ?? null);

  /**
   * A fully-resolved clone of the current request for the preview panel.
   * Uses the same variable merge order as execute() but has no side effects.
   * Returns null when no request is loaded.
   */
  readonly resolvedPreview = computed(() => {
    const request = this.currentRequest();
    if (!request) return null;
    const globalsMap    = this.globalsService.varMap();
    const collectionMap = this.collectionsService.varMapForCollection(request.collectionId);
    const envMap        = this.envService.activeVarMap();
    const requestMap    = buildVarMap(request.variables ?? []);
    return this.resolver.resolveForExecution(request, globalsMap, collectionMap, envMap, requestMap);
  });

  /**
   * The set of {{variable}} names that appear in the current request but
   * cannot be satisfied by any variable scope. Used for preview warnings.
   */
  readonly unresolvedVarNames = computed<Set<string>>(() => {
    const request = this.currentRequest();
    if (!request) return new Set<string>();
    const globalsMap    = this.globalsService.varMap();
    const collectionMap = this.collectionsService.varMapForCollection(request.collectionId);
    const envMap        = this.envService.activeVarMap();
    const requestMap    = buildVarMap(request.variables ?? []);
    return this.resolver.unresolvedVars(request, globalsMap, collectionMap, envMap, requestMap);
  });

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
   * Create a new unsaved tab pre-populated from a parsed cURL import.
   * `partial` must include at least `url`, `method`, and the auth/body fields.
   * Missing fields fall back to the blank-request defaults.
   */
  importFromParsed(partial: Partial<ApiRequest> & { name: string }): void {
    const now = new Date().toISOString();
    const req: ApiRequest = {
      id: crypto.randomUUID(),
      name: partial.name,
      method: partial.method ?? 'GET',
      url: partial.url ?? '',
      queryParams: partial.queryParams ?? [],
      headers: partial.headers ?? [],
      bodyType: partial.bodyType ?? 'none',
      bodyRaw: partial.bodyRaw ?? '',
      bodyFormFields: partial.bodyFormFields ?? [],
      auth: partial.auth ?? { type: 'none' },
      variables: [],
      assertions: [],
      createdAt: now,
      updatedAt: now,
    };
    this.tabsService.newTabWithRequest(req);
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
      // Merge variable scopes: globals < collection < environment < request overrides
      const globalsMap    = this.globalsService.varMap();
      const collectionMap = this.collectionsService.varMapForCollection(request.collectionId);
      const envMap        = this.envService.activeVarMap();
      const requestMap    = buildVarMap(request.variables ?? []);
      const resolved = this.resolver.resolveForExecution(
        request, globalsMap, collectionMap, envMap, requestMap,
      );
      const withAuth = applyAuth(resolved);

      const response = await firstValueFrom(this.runner.execute(withAuth));
      const assertionSummary = this.assertionService.evaluate(request.assertions ?? [], response);
      this.tabsService.setTabResponse(tabId, response, null, assertionSummary);

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

