import { Injectable, inject, signal } from '@angular/core';
import { HistoryItem } from '../../shared/models/history-item.model';
import { AppDbService } from '../storage/app-db.service';

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly db = inject(AppDbService);

  readonly items = signal<HistoryItem[]>([]);

  async init(): Promise<void> {
    const all = await this.db.history.orderBy('executedAt').reverse().toArray();
    this.items.set(all);
  }

  add(item: HistoryItem): void {
    this.items.update(existing => [item, ...existing]);
    this.db.history.add(item);
  }

  clear(): void {
    this.items.set([]);
    this.db.history.clear();
  }
}
