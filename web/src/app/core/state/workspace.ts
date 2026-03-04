import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiRequest } from '../../shared/models/api-request.model';
import { ApiResponse } from '../../shared/models/api-response.model';
import { HistoryItem } from '../../shared/models/history-item.model';
import { EnvironmentsService } from './environments';
import { HistoryService } from './history';
import { VariableResolverService } from '../utils/variable-resolver.service';
import { RunnerApiService } from '../api/runner-api.service';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {

  private readonly envService = inject(EnvironmentsService);
  private readonly historyService = inject(HistoryService);
  private readonly resolver = inject(VariableResolverService);
  private readonly runner = inject(RunnerApiService);

  // ── State ─────────────────────────────────────────────────────────────────

  /** The request currently loaded in the editor. */
  readonly currentRequest = signal<ApiRequest | null>(null);

  /**
   * When set, the editor loads this request into its form fields.
   * Set via loadRequest(); the editor watches this via an input binding.
   */
  readonly requestToLoad = signal<ApiRequest | null>(null);

  /** The most recent response, or null if not yet executed. */
  readonly response = signal<ApiResponse | null>(null);

  /** True while a request is in flight. */
  readonly isLoading = signal(false);

  /** Human-readable error from the last failed execution, or null. */
  readonly errorMessage = signal<string | null>(null);

  // ── Mutations ─────────────────────────────────────────────────────────────

  /** Called by the editor on every request state change. */
  setRequest(request: ApiRequest): void {
    this.currentRequest.set(request);
  }

  /**
   * Load a saved request into the editor and clear the previous response.
   * The editor observes requestToLoad via an input binding.
   */
  loadRequest(request: ApiRequest): void {
    this.requestToLoad.set(request);
    this.response.set(null);
    this.errorMessage.set(null);
  }

  /**
   * Resolve variables, apply auth, proxy through the backend runner,
   * update the response signal, and persist the result to history.
   */
  async execute(): Promise<void> {
    const request = this.currentRequest();
    if (!request || this.isLoading()) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const envMap = this.envService.activeVarMap();
      const resolved = this.resolver.resolveForExecution(request, envMap);
      const withAuth = applyAuth(resolved);

      const response = await firstValueFrom(this.runner.execute(withAuth));
      this.response.set(response);

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
      this.errorMessage.set(message);
      this.response.set(null);
    } finally {
      this.isLoading.set(false);
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
