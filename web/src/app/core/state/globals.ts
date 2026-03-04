import { Injectable, computed, inject, signal } from '@angular/core';
import { GlobalVariable } from '../../shared/models/globals.model';
import { AppDbService } from '../storage/app-db.service';
import { buildVarMap, VariableMap } from '../utils/variable-resolver';

const GLOBALS_ID = 'global' as const;

@Injectable({ providedIn: 'root' })
export class GlobalsService {
  private readonly db = inject(AppDbService);

  readonly variables = signal<GlobalVariable[]>([]);

  /** Flat VariableMap of all enabled global variables, ready for resolution. */
  readonly varMap = computed<VariableMap>(() => buildVarMap(this.variables()));

  /** Load the globals record from Dexie. Call once on app startup. */
  async init(): Promise<void> {
    const record = await this.db.globals.get(GLOBALS_ID);
    this.variables.set(record?.variables ?? []);
  }

  /** Replace all global variables and persist. */
  setVariables(variables: GlobalVariable[]): void {
    this.variables.set(variables);
    this.db.globals.put({ id: GLOBALS_ID, variables, updatedAt: new Date().toISOString() });
  }
}
