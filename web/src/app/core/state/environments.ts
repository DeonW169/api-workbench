import { Injectable, computed, inject, signal } from '@angular/core';
import { EnvironmentModel } from '../../shared/models/environment.model';
import { VariableMap, buildEnvMap } from '../utils/variable-resolver';
import { AppDbService } from '../storage/app-db.service';

/**
 * Signal-based state service for environment management.
 *
 * Responsibilities:
 *  - Stores the list of all environments.
 *  - Tracks which environment is currently active.
 *  - Exposes a ready-to-use VariableMap for the active environment
 *    so callers can pass it straight into VariableResolverService.
 *
 * This service is intentionally decoupled from VariableResolverService to
 * keep a clean dependency direction:
 *   EnvironmentsService  ──▶  variable-resolver (pure utils)
 *   VariableResolverService  ──▶  variable-resolver (pure utils)
 *   Orchestrators  ──▶  both services, composing them at call time.
 */
@Injectable({ providedIn: 'root' })
export class EnvironmentsService {

  private readonly db = inject(AppDbService);

  // ── State ─────────────────────────────────────────────────────────────────

  /** Full list of known environments. */
  readonly environments = signal<EnvironmentModel[]>([]);

  /**
   * ID of the currently active environment.
   * Null means "No Environment" — resolution returns an empty VariableMap.
   */
  readonly activeId = signal<string | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────

  /** The active EnvironmentModel, or null when none is selected. */
  readonly activeEnvironment = computed<EnvironmentModel | null>(() => {
    const id = this.activeId();
    if (!id) return null;
    return this.environments().find(e => e.id === id) ?? null;
  });

  /**
   * Flat VariableMap built from the active environment's enabled variables.
   * Empty when no environment is selected or the active env has no enabled vars.
   *
   * Pass this directly into VariableResolverService.resolveForExecution():
   *   resolver.resolveForExecution(request, envService.activeVarMap())
   */
  readonly activeVarMap = computed<VariableMap>(() =>
    buildEnvMap(this.activeEnvironment()),
  );

  // ── Mutations ─────────────────────────────────────────────────────────────

  /** Load all environments from Dexie. Call once on app startup. */
  async init(): Promise<void> {
    const all = await this.db.environments.orderBy('name').toArray();
    this.environments.set(all);
  }

  /** Select an environment by ID, or pass null to deselect. */
  setActive(id: string | null): void {
    this.activeId.set(id);
  }

  /**
   * Insert a new environment or replace an existing one by ID.
   * The list order is preserved; new environments are appended.
   */
  upsert(env: EnvironmentModel): void {
    this.environments.update(envs => {
      const idx = envs.findIndex(e => e.id === env.id);
      return idx === -1
        ? [...envs, env]
        : envs.map((e, i) => (i === idx ? env : e));
    });
    this.db.environments.put(env);
  }

  /**
   * Remove an environment by ID.
   * If it was active, the active selection is cleared.
   */
  remove(id: string): void {
    this.environments.update(envs => envs.filter(e => e.id !== id));
    if (this.activeId() === id) {
      this.activeId.set(null);
    }
    this.db.environments.delete(id);
  }
}
