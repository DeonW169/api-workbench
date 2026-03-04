import { Injectable, inject, signal } from '@angular/core';
import { Collection } from '../../shared/models/collection.model';
import { AppDbService } from '../storage/app-db.service';

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
  return { id: crypto.randomUUID(), name, createdAt: now, updatedAt: now };
}

function byName(a: Collection, b: Collection): number {
  return a.name.localeCompare(b.name);
}
