import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { ApiRequest } from '../../shared/models/api-request.model';
import { Collection } from '../../shared/models/collection.model';
import { EnvironmentModel } from '../../shared/models/environment.model';
import { Folder } from '../../shared/models/folder.model';
import { GlobalsRecord } from '../../shared/models/globals.model';
import { HistoryItem } from '../../shared/models/history-item.model';

@Injectable({ providedIn: 'root' })
export class AppDbService extends Dexie {
  requests!: Table<ApiRequest, string>;
  collections!: Table<Collection, string>;
  folders!: Table<Folder, string>;
  environments!: Table<EnvironmentModel, string>;
  history!: Table<HistoryItem, string>;
  globals!: Table<GlobalsRecord, string>;

  constructor() {
    super('api-workbench-db');

    // Version 1: original schema — never change this block.
    this.version(1).stores({
      requests: 'id, name, method, updatedAt, collectionId, folderId',
      environments: 'id, name, updatedAt',
      history: 'id, executedAt',
    });

    // Version 2: adds collections and folders tables.
    // Existing tables carry over unchanged; no migration function needed.
    this.version(2).stores({
      requests: 'id, name, method, updatedAt, collectionId, folderId',
      collections: 'id, name, updatedAt',
      folders: 'id, collectionId, parentFolderId, updatedAt',
      environments: 'id, name, updatedAt',
      history: 'id, executedAt',
    });

    // Version 3: adds globals singleton table.
    this.version(3).stores({
      requests: 'id, name, method, updatedAt, collectionId, folderId',
      collections: 'id, name, updatedAt',
      folders: 'id, collectionId, parentFolderId, updatedAt',
      environments: 'id, name, updatedAt',
      history: 'id, executedAt',
      globals: 'id',
    });

    // Version 4: adds an explicit `order` field so collection runs execute in a
    // sequence the user controls, instead of "most recently edited first".
    this.version(4)
      .stores({
        requests: 'id, name, method, updatedAt, collectionId, folderId, order',
        collections: 'id, name, updatedAt',
        folders: 'id, collectionId, parentFolderId, updatedAt',
        environments: 'id, name, updatedAt',
        history: 'id, executedAt',
        globals: 'id',
      })
      .upgrade(async tx => {
        // Backfill from createdAt so existing requests keep a stable, sensible
        // order rather than all colliding on 0.
        const all = await tx.table<ApiRequest>('requests').toArray();
        const byGroup = new Map<string, ApiRequest[]>();
        for (const req of all) {
          const key = `${req.collectionId ?? ''}/${req.folderId ?? ''}`;
          byGroup.set(key, [...(byGroup.get(key) ?? []), req]);
        }
        for (const group of byGroup.values()) {
          // Guarded: a record with no createdAt would otherwise throw inside the
          // upgrade transaction, which aborts db.open() and makes the entire
          // database — collections, environments, history — unopenable.
          group.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
          await Promise.all(
            group.map((req, index) =>
              tx.table('requests').update(req.id, { order: index }),
            ),
          );
        }
      });
  }
}
