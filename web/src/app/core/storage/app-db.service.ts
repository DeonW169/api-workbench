import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { ApiRequest } from '../../shared/models/api-request.model';
import { Collection } from '../../shared/models/collection.model';
import { EnvironmentModel } from '../../shared/models/environment.model';
import { Folder } from '../../shared/models/folder.model';
import { HistoryItem } from '../../shared/models/history-item.model';

@Injectable({ providedIn: 'root' })
export class AppDbService extends Dexie {
  requests!: Table<ApiRequest, string>;
  collections!: Table<Collection, string>;
  folders!: Table<Folder, string>;
  environments!: Table<EnvironmentModel, string>;
  history!: Table<HistoryItem, string>;

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
  }
}
