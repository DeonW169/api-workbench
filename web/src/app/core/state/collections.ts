import { Injectable, inject, signal } from '@angular/core';
import { Collection, CollectionVariable } from '../../shared/models/collection.model';
import { AppDbService } from '../storage/app-db.service';
import { buildVarMap, VariableMap } from '../utils/variable-resolver';

const DEFAULT_COLLECTION_NAME = 'My Requests';

@Injectable({ providedIn: 'root' })
export class CollectionsService {
  private readonly db = inject(AppDbService);

  readonly collections = signal<Collection[]>([]);

  /**
   * Load all collections from Dexie.
   * If none exist, a default collection is created automatically.
   */
  async init(): Promise<void> {
    let all = await this.db.collections.orderBy('name').toArray();

    if (all.length === 0) {
      const defaultCollection = createCollection(DEFAULT_COLLECTION_NAME);
      await this.db.collections.add(defaultCollection);
      all = [defaultCollection];
    }

    this.collections.set(all);
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  /** Add a new collection and persist it. */
  create(name: string): Collection {
    const collection = createCollection(name.trim() || 'New Collection');
    this.collections.update(cols => [...cols, collection].sort(byName));
    this.db.collections.add(collection);
    return collection;
  }

  /** Rename an existing collection. */
  rename(id: string, name: string): void {
    const trimmed = name.trim() || 'New Collection';
    const updatedAt = new Date().toISOString();
    this.collections.update(cols =>
      cols
        .map(c => (c.id === id ? { ...c, name: trimmed, updatedAt } : c))
        .sort(byName),
    );
    this.db.collections.where('id').equals(id).modify({ name: trimmed, updatedAt });
  }

  /** Replace the variable list for a collection. */
  setVariables(id: string, variables: CollectionVariable[]): void {
    const updatedAt = new Date().toISOString();
    this.collections.update(cols =>
      cols.map(c => (c.id === id ? { ...c, variables, updatedAt } : c)),
    );
    this.db.collections.where('id').equals(id).modify({ variables, updatedAt });
  }

  /**
   * Build a VariableMap from the variables of a specific collection.
   * Returns an empty map if the collection is not found or has no variables.
   */
  varMapForCollection(collectionId: string | null | undefined): VariableMap {
    if (!collectionId) return {};
    const col = this.collections().find(c => c.id === collectionId);
    return col ? buildVarMap(col.variables) : {};
  }

  /**
   * Delete a collection.
   * Caller is responsible for handling orphaned requests and folders
   * (e.g. nullify their collectionId or delete them separately).
   */
  delete(id: string): void {
    this.collections.update(cols => cols.filter(c => c.id !== id));
    this.db.collections.delete(id);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function createCollection(name: string): Collection {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), name, variables: [], createdAt: now, updatedAt: now };
}

function byName(a: Collection, b: Collection): number {
  return a.name.localeCompare(b.name);
}
