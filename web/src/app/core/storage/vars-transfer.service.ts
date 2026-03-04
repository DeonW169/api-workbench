import { Injectable, inject } from '@angular/core';
import { CollectionVariable } from '../../shared/models/collection.model';
import { EnvironmentModel, EnvironmentVariable } from '../../shared/models/environment.model';
import { GlobalVariable } from '../../shared/models/globals.model';
import { CollectionsService } from '../state/collections';
import { EnvironmentsService } from '../state/environments';
import { GlobalsService } from '../state/globals';

// ── Backup shape ──────────────────────────────────────────────────────────────

export interface CollectionVarsEntry {
  id: string;
  name: string;
  variables: CollectionVariable[];
}

export interface VariablesBackup {
  formatName: 'api-workbench-variables';
  formatVersion: 1;
  exportedAt: string;
  globals: GlobalVariable[];
  environments: EnvironmentModel[];
  collections: CollectionVarsEntry[];
}

export type VarsImportError =
  | 'invalid-json'
  | 'not-a-variables-backup'
  | 'unsupported-version'
  | 'invalid-structure';

const ERROR_MESSAGES: Record<VarsImportError, string> = {
  'invalid-json': 'Could not parse file — is it valid JSON?',
  'not-a-variables-backup': 'Not a variables backup file.',
  'unsupported-version': 'Unsupported backup version.',
  'invalid-structure': 'File structure is invalid or corrupt.',
};

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class VarsTransferService {
  private readonly globals = inject(GlobalsService);
  private readonly environments = inject(EnvironmentsService);
  private readonly collections = inject(CollectionsService);

  // ── Export ─────────────────────────────────────────────────────────────────

  exportVariables(): void {
    const backup: VariablesBackup = {
      formatName: 'api-workbench-variables',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      globals: this.globals.variables(),
      environments: this.environments.environments(),
      collections: this.collections.collections().map(c => ({
        id: c.id,
        name: c.name,
        variables: c.variables,
      })),
    };

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);

    const a = document.createElement('a');
    a.href = url;
    a.download = `api-workbench-variables-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  /** Returns a user-friendly error message, or null on success. */
  async importVariables(file: File): Promise<string | null> {
    const text = await file.text();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return ERROR_MESSAGES['invalid-json'];
    }

    const err = this.validate(parsed);
    if (err) return ERROR_MESSAGES[err];

    const backup = parsed as VariablesBackup;
    this.apply(backup);
    return null;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private validate(data: unknown): VarsImportError | null {
    if (!isObject(data)) return 'invalid-structure';
    if (data['formatName'] !== 'api-workbench-variables') return 'not-a-variables-backup';
    if (data['formatVersion'] !== 1) return 'unsupported-version';

    if (!Array.isArray(data['globals'])) return 'invalid-structure';
    if (!Array.isArray(data['environments'])) return 'invalid-structure';
    if (!Array.isArray(data['collections'])) return 'invalid-structure';

    for (const v of data['globals'] as unknown[]) {
      if (!isVarRow(v)) return 'invalid-structure';
    }
    for (const e of data['environments'] as unknown[]) {
      if (!isEnvironment(e)) return 'invalid-structure';
    }
    for (const c of data['collections'] as unknown[]) {
      if (!isCollectionEntry(c)) return 'invalid-structure';
    }

    return null;
  }

  private apply(backup: VariablesBackup): void {
    // Globals — replace entirely
    this.globals.setVariables(backup.globals);

    // Environments — upsert all (creates new ones, updates existing)
    for (const env of backup.environments) {
      this.environments.upsert(env);
    }

    // Collections — only update variables on collections that already exist
    const knownIds = new Set(this.collections.collections().map(c => c.id));
    for (const entry of backup.collections) {
      if (knownIds.has(entry.id)) {
        this.collections.setVariables(entry.id, entry.variables);
      }
    }
  }
}

// ── Type guards ───────────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isVarRow(v: unknown): v is GlobalVariable {
  if (!isObject(v)) return false;
  return typeof v['key'] === 'string' &&
    typeof v['value'] === 'string' &&
    typeof v['enabled'] === 'boolean';
}

function isEnvironment(v: unknown): v is EnvironmentModel {
  if (!isObject(v)) return false;
  return typeof v['id'] === 'string' &&
    typeof v['name'] === 'string' &&
    Array.isArray(v['variables']) &&
    (v['variables'] as unknown[]).every(isVarRow);
}

function isCollectionEntry(v: unknown): v is CollectionVarsEntry {
  if (!isObject(v)) return false;
  return typeof v['id'] === 'string' &&
    typeof v['name'] === 'string' &&
    Array.isArray(v['variables']) &&
    (v['variables'] as unknown[]).every(isVarRow);
}
