import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { ApiRequest } from '../../shared/models/api-request.model';
import { ApiResponse } from '../../shared/models/api-response.model';
import {
  CollectionRunEvent,
  CollectionRunItem,
  CollectionRunOptions,
  CollectionRunScope,
  CollectionRunSummary,
  DEFAULT_RUN_OPTIONS,
} from '../../shared/models/collection-run.model';
import { CollectionsService } from './collections';
import { EnvironmentsService } from './environments';
import { GlobalsService } from './globals';
import { RequestsService } from './requests';
import { AssertionService } from '../utils/assertion.service';
import { RunnerApiService } from '../api/runner-api.service';
import { VariableResolverService, buildVarMap } from '../utils/variable-resolver.service';
import { applyAuth } from '../utils/auth';

@Injectable({ providedIn: 'root' })
export class CollectionRunnerService {
  private readonly requestsService  = inject(RequestsService);
  private readonly collectionsService = inject(CollectionsService);
  private readonly envService         = inject(EnvironmentsService);
  private readonly globalsService     = inject(GlobalsService);
  private readonly resolver           = inject(VariableResolverService);
  private readonly assertionService   = inject(AssertionService);
  private readonly runner             = inject(RunnerApiService);

  /**
   * Execute all requests in the given scope sequentially and emit progress events.
   *
   * Emits:
   *   - `start`    before each request is sent (index, total, request)
   *   - `result`   after each request completes (index, CollectionRunItem)
   *   - `complete` once all requests finish (CollectionRunSummary)
   *
   * Network errors are captured per item and never propagate to the Observable
   * error channel, so the run always terminates with a `complete` event.
   *
   * Variable resolution uses the same scope order as the interactive workspace:
   *   globals < collection < active environment < per-request overrides
   *
   * @example
   *   const sub = collectionRunner
   *     .run({ collectionId }, { stopOnFailure: true, delayMs: 250 })
   *     .subscribe({
   *       next: event => { ... },
   *       complete: () => console.log('done'),
   *     });
   *   // Cancel mid-run:
   *   sub.unsubscribe();
   */
  run(
    scope: CollectionRunScope,
    options: CollectionRunOptions = DEFAULT_RUN_OPTIONS,
  ): Observable<CollectionRunEvent> {
    return new Observable<CollectionRunEvent>(subscriber => {
      let cancelled = false;

      (async () => {
        const requests = this.resolveScope(scope);
        const total    = requests.length;
        const items: CollectionRunItem[] = [];
        let stoppedEarly = false;

        for (let i = 0; i < total; i++) {
          if (cancelled) { stoppedEarly = true; break; }

          const request = requests[i];
          subscriber.next({ type: 'start', index: i, total, request });

          const item = await this.executeOne(request);
          items.push(item);
          subscriber.next({ type: 'result', index: i, item });

          if (options.stopOnFailure && !item.passed) {
            stoppedEarly = true;
            break;
          }

          if (options.delayMs > 0 && i < total - 1 && !cancelled) {
            await delay(options.delayMs);
          }
        }

        if (cancelled) return;

        const skipped = total - items.length;
        const summary: CollectionRunSummary = {
          totalRequests:  total,
          passed:         items.filter(r => r.passed).length,
          failed:         items.filter(r => !r.passed).length,
          skipped,
          totalDurationMs: items.reduce((sum, r) => sum + r.durationMs, 0),
          items,
          stoppedEarly,
        };

        subscriber.next({ type: 'complete', summary });
        subscriber.complete();
      })().catch(err => {
        if (!cancelled) subscriber.error(err);
      });

      // Teardown: set the cancellation flag when the consumer unsubscribes
      return () => { cancelled = true; };
    });
  }

  // ── Scope resolution ──────────────────────────────────────────────────────

  /**
   * Return the requests that belong to the given scope in their current
   * in-memory order (most recently updated first, matching RequestsService).
   */
  private resolveScope(scope: CollectionRunScope): ApiRequest[] {
    const all = this.requestsService.requests();
    if (scope.folderId) {
      return all.filter(
        r => r.collectionId === scope.collectionId && r.folderId === scope.folderId,
      );
    }
    return all.filter(r => r.collectionId === scope.collectionId);
  }

  // ── Single-request execution ──────────────────────────────────────────────

  private async executeOne(request: ApiRequest): Promise<CollectionRunItem> {
    try {
      // Merge variable scopes: globals < collection < environment < request
      const globalsMap    = this.globalsService.varMap();
      const collectionMap = this.collectionsService.varMapForCollection(request.collectionId);
      const envMap        = this.envService.activeVarMap();
      const requestMap    = buildVarMap(request.variables ?? []);

      const resolved = this.resolver.resolveForExecution(
        request, globalsMap, collectionMap, envMap, requestMap,
      );
      const withAuth = applyAuth(resolved);

      const response: ApiResponse = await firstValueFrom(this.runner.execute(withAuth));

      const hasAssertions = (request.assertions?.length ?? 0) > 0;
      const assertionSummary = hasAssertions
        ? this.assertionService.evaluate(request.assertions, response)
        : null;

      // Pass/fail: assertions are the arbiter when present; fall back to HTTP ok.
      const passed = assertionSummary !== null
        ? assertionSummary.failed === 0
        : response.ok;

      return {
        request,
        response,
        assertionSummary,
        passed,
        error: null,
        durationMs: response.durationMs,
      };

    } catch (err: unknown) {
      return {
        request,
        response:         null,
        assertionSummary: null,
        passed:           false,
        error:            err instanceof Error ? err.message : 'An unexpected error occurred.',
        durationMs:       0,
      };
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
