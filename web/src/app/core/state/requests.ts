import { Injectable, inject, signal } from '@angular/core';
import { ApiRequest } from '../../shared/models/api-request.model';
import { AppDbService } from '../storage/app-db.service';

@Injectable({ providedIn: 'root' })
export class RequestsService {

  private readonly db = inject(AppDbService);

  // ── State ─────────────────────────────────────────────────────────────────

  /** All saved requests, most recently updated first. */
  readonly requests = signal<ApiRequest[]>([]);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Load all saved requests from Dexie. Call once on app startup. */
  async init(): Promise<void> {
    const all = await this.db.requests.orderBy('updatedAt').reverse().toArray();
    this.requests.set(all);
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  /**
   * Persist a request (insert or update by id).
   * New requests are prepended; existing ones are updated in place.
   */
  save(request: ApiRequest): void {
    const toSave: ApiRequest = { ...request, updatedAt: new Date().toISOString() };
    this.requests.update(reqs => {
      const idx = reqs.findIndex(r => r.id === toSave.id);
      return idx === -1
        ? [toSave, ...reqs]
        : reqs.map((r, i) => (i === idx ? toSave : r));
    });
    this.db.requests.put(toSave);
  }

  /** Rename a saved request without touching any other fields. */
  rename(id: string, name: string): void {
    const trimmed = name.trim() || 'New Request';
    const updatedAt = new Date().toISOString();
    this.requests.update(reqs =>
      reqs.map(r => r.id === id ? { ...r, name: trimmed, updatedAt } : r),
    );
    this.db.requests.where('id').equals(id).modify({ name: trimmed, updatedAt });
  }

  /** Clone a request, inserting the copy immediately after the original. */
  duplicate(id: string): ApiRequest | null {
    const original = this.requests().find(r => r.id === id);
    if (!original) return null;

    const now = new Date().toISOString();
    const copy: ApiRequest = {
      ...original,
      id: crypto.randomUUID(),
      name: `${original.name} (copy)`,
      createdAt: now,
      updatedAt: now,
    };

    this.requests.update(reqs => {
      const idx = reqs.findIndex(r => r.id === id);
      const next = [...reqs];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    this.db.requests.add(copy);
    return copy;
  }

  /** Remove a saved request. */
  delete(id: string): void {
    this.requests.update(reqs => reqs.filter(r => r.id !== id));
    this.db.requests.delete(id);
  }
}
