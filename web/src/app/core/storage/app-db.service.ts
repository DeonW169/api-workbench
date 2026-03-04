import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { ApiRequest } from '../../shared/models/api-request.model';
import { EnvironmentModel } from '../../shared/models/environment.model';
import { HistoryItem } from '../../shared/models/history-item.model';

@Injectable({ providedIn: 'root' })
export class AppDbService extends Dexie {
    requests!: Table<ApiRequest, string>;
    environments!: Table<EnvironmentModel, string>;
    history!: Table<HistoryItem, string>;

    constructor() {
        super('api-workbench-db');

        this.version(1).stores({
            requests: 'id, name, method, updatedAt, collectionId, folderId',
            environments: 'id, name, updatedAt',
            history: 'id, executedAt'
        });
    }
}