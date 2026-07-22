import { Injectable, inject, signal } from '@angular/core';
import { ApiRequest } from '../../shared/models/api-request.model';
import { AppDbService } from '../storage/app-db.service';

@Injectable({ providedIn: 'root' })
export class RequestsService {

  private readonly db = inject(AppDbService);

  // ── State ─────────────────────────────────────────────────────────────────

  /**
   * All saved requests, in explicit `order` within each collection/folder.
   *
   * This ordering is what the tree renders and what the collection runner
   * executes, so it must be deterministic and user-controlled — sorting by
   * `updatedAt` meant a run's sequence changed every time a request was edited.
   */
  readonly requests = signal<ApiRequest[]>([]);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Load all saved requests from Dexie. Call once on app startup.
   *
   * Any record without an `order` (imported from an older backup, or written
   * before schema v4) is repaired here, so the rest of the service can rely on
   * `order` always being present and dense.
   */
  async init(): Promise<void> {
    const all = await this.db.requests.toArray();
    const repaired = renumber(sortRequests(all));
    this.requests.set(repaired);

    const before = new Map(all.map(r => [r.id, r.order]));
    for (const req of repaired) {
      if (before.get(req.id) !== req.order) {
        this.db.requests.where('id').equals(req.id).modify({ order: req.order });
      }
    }
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  /**
   * Persist a request (insert or update by id).
   * New requests land at the end of their group; existing ones keep their slot.
   */
  save(request: ApiRequest): void {
    const existing = this.requests().find(r => r.id === request.id);
    // A request that moved to another collection/folder cannot keep its old
    // index — that slot belongs to the previous group.
    const sameGroup =
      existing !== undefined &&
      (existing.collectionId ?? null) === (request.collectionId ?? null) &&
      (existing.folderId ?? null) === (request.folderId ?? null);

    const toSave: ApiRequest = {
      ...request,
      order: sameGroup ? existing.order : this.nextOrder(request),
      updatedAt: new Date().toISOString(),
    };
    this.requests.update(reqs => {
      const idx = reqs.findIndex(r => r.id === toSave.id);
      const next = idx === -1 ? [...reqs, toSave] : reqs.map((r, i) => (i === idx ? toSave : r));
      return sortRequests(next);
    });
    this.db.requests.put(toSave);
  }

  /**
   * The next free position within a request's collection/folder group.
   *
   * Missing orders count as "sorts last" here exactly as they do in
   * sortRequests — using a different sentinel in the two places would place a
   * new request *before* its siblings instead of after them.
   */
  private nextOrder(request: Pick<ApiRequest, 'collectionId' | 'folderId'>): number {
    const orders = this.siblingsOf(request)
      .map(r => r.order)
      .filter((o): o is number => typeof o === 'number');
    return orders.length === 0 ? 0 : Math.max(...orders) + 1;
  }

  private siblingsOf(request: Pick<ApiRequest, 'collectionId' | 'folderId'>): ApiRequest[] {
    return this.requests().filter(
      r =>
        (r.collectionId ?? null) === (request.collectionId ?? null) &&
        (r.folderId ?? null) === (request.folderId ?? null),
    );
  }

  /**
   * Move a request one position up or down among its siblings.
   * No-op at the boundaries. Persists the new positions for the whole group.
   */
  move(id: string, direction: -1 | 1): void {
    const request = this.requests().find(r => r.id === id);
    if (!request) return;

    const siblings = this.siblingsOf(request);
    const index = siblings.findIndex(r => r.id === id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= siblings.length) return;

    const reordered = [...siblings];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    // Renumber the whole group so positions stay dense and gap-free.
    this.applyGroupOrder(reordered);
  }

  /** True when the request is already first among its siblings. */
  isFirst(request: ApiRequest): boolean {
    return this.siblingsOf(request)[0]?.id === request.id;
  }

  /** True when the request is already last among its siblings. */
  isLast(request: ApiRequest): boolean {
    const siblings = this.siblingsOf(request);
    return siblings[siblings.length - 1]?.id === request.id;
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

    // Insert directly after the original and renumber the group, so the copy
    // sits beside its source in both the tree and the run sequence.
    const siblings = this.siblingsOf(original);
    const at = siblings.findIndex(r => r.id === id);
    const reordered = [...siblings];
    reordered.splice(at + 1, 0, copy);

    this.applyGroupOrder(reordered, copy);
    this.db.requests.add(this.requests().find(r => r.id === copy.id) ?? copy);
    return copy;
  }

  /**
   * Renumber a group densely, merge it back into the store, and persist.
   * `inserted` is a request not yet present in the signal, if any.
   */
  private applyGroupOrder(reordered: ApiRequest[], inserted?: ApiRequest): void {
    const positions = new Map(reordered.map((r, i) => [r.id, i]));
    this.requests.update(reqs => {
      const merged = inserted ? [...reqs, inserted] : reqs;
      return sortRequests(
        merged.map(r => (positions.has(r.id) ? { ...r, order: positions.get(r.id)! } : r)),
      );
    });
    for (const [reqId, order] of positions) {
      if (reqId === inserted?.id) continue; // written by the caller's add()
      this.db.requests.where('id').equals(reqId).modify({ order });
    }
  }

  /** Remove a saved request. */
  delete(id: string): void {
    this.requests.update(reqs => reqs.filter(r => r.id !== id));
    this.db.requests.delete(id);
  }

  /**
   * Create a blank request in a specific collection (and optionally folder),
   * persist it immediately, and return it.
   */
  createInCollection(
    collectionId: string | null,
    folderId: string | null = null,
  ): ApiRequest {
    const now = new Date().toISOString();
    const request: ApiRequest = {
      id: crypto.randomUUID(),
      name: 'New Request',
      method: 'GET',
      url: '',
      queryParams: [],
      headers: [],
      bodyType: 'none',
      bodyRaw: '',
      bodyFormFields: [],
      auth: { type: 'none' },
      variables: [],
      assertions: [],
      collectionId: collectionId ?? undefined,
      folderId: folderId ?? undefined,
      order: this.nextOrder({ collectionId, folderId }),
      createdAt: now,
      updatedAt: now,
    };
    this.requests.update(reqs => sortRequests([...reqs, request]));
    this.db.requests.add(request);
    return request;
  }

  /** Remove all requests belonging to a collection (cascade delete). */
  deleteByCollection(collectionId: string): void {
    this.requests.update(reqs => reqs.filter(r => r.collectionId !== collectionId));
    this.db.requests.where('collectionId').equals(collectionId).delete();
  }

  /** Remove all requests belonging to a folder (cascade delete). */
  deleteByFolder(folderId: string): void {
    this.requests.update(reqs => reqs.filter(r => r.folderId !== folderId));
    this.db.requests.where('folderId').equals(folderId).delete();
  }
}

/**
 * Group by collection/folder, then sort by explicit `order`.
 *
 * Records predating schema v4 may lack `order`; they sort last, then by
 * createdAt, so the list is always fully deterministic.
 */
function sortRequests(requests: ApiRequest[]): ApiRequest[] {
  return [...requests].sort((a, b) => {
    const groupA = groupKey(a);
    const groupB = groupKey(b);
    if (groupA !== groupB) return groupA.localeCompare(groupB);

    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;

    // createdAt is guarded: a malformed record must not throw on the hot path.
    return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
  });
}

/** Stable grouping key. Ids are UUIDs, so `/` cannot appear inside one. */
function groupKey(r: Pick<ApiRequest, 'collectionId' | 'folderId'>): string {
  return `${r.collectionId ?? ''}/${r.folderId ?? ''}`;
}

/**
 * Assign dense 0..n-1 positions within each group, preserving current relative
 * order. Repairs records that predate the `order` field.
 */
function renumber(sorted: ApiRequest[]): ApiRequest[] {
  const counters = new Map<string, number>();
  return sorted.map(req => {
    const key = groupKey(req);
    const next = counters.get(key) ?? 0;
    counters.set(key, next + 1);
    return req.order === next ? req : { ...req, order: next };
  });
}
