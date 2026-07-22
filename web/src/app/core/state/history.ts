import { Injectable, inject, signal } from '@angular/core';
import { HistoryItem } from '../../shared/models/history-item.model';
import { AppDbService } from '../storage/app-db.service';

/**
 * Maximum retained executions. Each entry stores a full request *and* response —
 * including base64 image payloads — so an uncapped log grows without bound and
 * keeps credentials around indefinitely.
 */
export const HISTORY_LIMIT = 200;

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly db = inject(AppDbService);

  readonly items = signal<HistoryItem[]>([]);

  async init(): Promise<void> {
    const all = await this.db.history.orderBy('executedAt').reverse().toArray();
    this.items.set(all.slice(0, HISTORY_LIMIT));
    // Drop anything beyond the cap left over from before it existed.
    void this.prune(all.slice(HISTORY_LIMIT).map(i => i.id));
  }

  add(item: HistoryItem): void {
    let evicted: string[] = [];
    this.items.update(existing => {
      const next = [item, ...existing];
      evicted = next.slice(HISTORY_LIMIT).map(i => i.id);
      return next.slice(0, HISTORY_LIMIT);
    });
    this.db.history.add(item);
    void this.prune(evicted);
  }

  private async prune(ids: string[]): Promise<void> {
    if (ids.length > 0) await this.db.history.bulkDelete(ids);
  }

  clear(): void {
    this.items.set([]);
    this.db.history.clear();
  }
}
