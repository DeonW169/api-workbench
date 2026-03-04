import { Injectable, inject, signal } from '@angular/core';
import { Folder } from '../../shared/models/folder.model';
import { AppDbService } from '../storage/app-db.service';

@Injectable({ providedIn: 'root' })
export class FoldersService {
  private readonly db = inject(AppDbService);

  readonly folders = signal<Folder[]>([]);

  /** Load all folders from Dexie. */
  async init(): Promise<void> {
    const all = await this.db.folders.orderBy('name').toArray();
    this.folders.set(all);
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  /** Create a folder inside a collection, optionally nested under a parent folder. */
  create(name: string, collectionId: string, parentFolderId: string | null = null): Folder {
    const folder = createFolder(name.trim() || 'New Folder', collectionId, parentFolderId);
    this.folders.update(folders => [...folders, folder].sort(byName));
    this.db.folders.add(folder);
    return folder;
  }

  /** Rename a folder. */
  rename(id: string, name: string): void {
    const trimmed = name.trim() || 'New Folder';
    const updatedAt = new Date().toISOString();
    this.folders.update(folders =>
      folders
        .map(f => (f.id === id ? { ...f, name: trimmed, updatedAt } : f))
        .sort(byName),
    );
    this.db.folders.where('id').equals(id).modify({ name: trimmed, updatedAt });
  }

  /**
   * Delete a folder.
   * Caller is responsible for handling orphaned requests
   * (e.g. nullify their folderId or delete them separately).
   */
  delete(id: string): void {
    this.folders.update(folders => folders.filter(f => f.id !== id));
    this.db.folders.delete(id);
  }

  /** Get all top-level folders for a given collection. */
  forCollection(collectionId: string): Folder[] {
    return this.folders().filter(
      f => f.collectionId === collectionId && f.parentFolderId === null,
    );
  }

  /** Get all direct child folders of a given parent folder. */
  childrenOf(parentFolderId: string): Folder[] {
    return this.folders().filter(f => f.parentFolderId === parentFolderId);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function createFolder(
  name: string,
  collectionId: string,
  parentFolderId: string | null,
): Folder {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    collectionId,
    parentFolderId,
    name,
    createdAt: now,
    updatedAt: now,
  };
}

function byName(a: Folder, b: Folder): number {
  return a.name.localeCompare(b.name);
}
