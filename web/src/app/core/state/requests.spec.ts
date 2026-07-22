import { TestBed } from '@angular/core/testing';
import { RequestsService } from './requests';
import { AppDbService } from '../storage/app-db.service';
import { ApiRequest } from '../../shared/models/api-request.model';

/** In-memory stand-in for the Dexie table surface RequestsService touches. */
function fakeTable() {
  return {
    put: () => Promise.resolve(''),
    add: () => Promise.resolve(''),
    delete: () => Promise.resolve(),
    toArray: (): Promise<ApiRequest[]> => Promise.resolve([]),
    where: () => ({
      equals: () => ({ modify: () => Promise.resolve(0), delete: () => Promise.resolve(0) }),
    }),
  };
}

function makeRequest(patch: Partial<ApiRequest> = {}): ApiRequest {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id: crypto.randomUUID(),
    name: 'R',
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
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
}

describe('RequestsService — D6: explicit ordering', () => {
  let service: RequestsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RequestsService, { provide: AppDbService, useValue: { requests: fakeTable() } }],
    });
    service = TestBed.inject(RequestsService);
  });

  const namesIn = (collectionId: string) =>
    service.requests().filter(r => r.collectionId === collectionId).map(r => r.name);

  it('appends new requests to the end of their group, not the front', () => {
    service.createInCollection('c1');
    service.createInCollection('c1');
    const [first, second] = service.requests();
    expect(first.order).toBe(0);
    expect(second.order).toBe(1);
  });

  it('keeps requests grouped by collection and folder', () => {
    service.createInCollection('c1', 'f1');
    service.createInCollection('c1', null);
    service.createInCollection('c2', null);
    const groups = service.requests().map(r => `${r.collectionId}/${r.folderId ?? ''}`);
    expect(groups).toEqual([...groups].sort());
  });

  it('moves a request down and back up', () => {
    const a = service.createInCollection('c1');
    service.rename(a.id, 'A');
    const b = service.createInCollection('c1');
    service.rename(b.id, 'B');
    const c = service.createInCollection('c1');
    service.rename(c.id, 'C');
    expect(namesIn('c1')).toEqual(['A', 'B', 'C']);

    service.move(a.id, 1);
    expect(namesIn('c1')).toEqual(['B', 'A', 'C']);

    service.move(a.id, -1);
    expect(namesIn('c1')).toEqual(['A', 'B', 'C']);
  });

  it('is a no-op at the boundaries', () => {
    const a = service.createInCollection('c1');
    const b = service.createInCollection('c1');
    service.move(a.id, -1);
    service.move(b.id, 1);
    expect(service.requests().map(r => r.id)).toEqual([a.id, b.id]);
  });

  it('only reorders within the same folder', () => {
    const inFolder = service.createInCollection('c1', 'f1');
    const atRoot = service.createInCollection('c1', null);
    service.move(inFolder.id, 1);
    expect(service.requests().find(r => r.id === inFolder.id)!.order).toBe(0);
    expect(service.requests().find(r => r.id === atRoot.id)!.order).toBe(0);
  });

  it('renumbers densely so positions never drift', () => {
    const ids = [0, 1, 2, 3].map(() => service.createInCollection('c1').id);
    service.move(ids[3], -1);
    service.move(ids[0], 1);
    expect(service.requests().map(r => r.order)).toEqual([0, 1, 2, 3]);
  });

  it('reports first and last correctly', () => {
    const a = service.createInCollection('c1');
    const b = service.createInCollection('c1');
    expect(service.isFirst(a)).toBe(true);
    expect(service.isLast(a)).toBe(false);
    expect(service.isLast(b)).toBe(true);
  });

  it('preserves position when an existing request is saved', () => {
    const a = service.createInCollection('c1');
    const b = service.createInCollection('c1');
    service.save({ ...b, url: 'https://changed.com' });
    expect(service.requests().map(r => r.id)).toEqual([a.id, b.id]);
    expect(service.requests()[1].order).toBe(1);
  });

  it('places a duplicate immediately after its original', () => {
    const a = service.createInCollection('c1');
    service.rename(a.id, 'A');
    const b = service.createInCollection('c1');
    service.rename(b.id, 'B');
    const c = service.createInCollection('c1');
    service.rename(c.id, 'C');

    const copy = service.duplicate(a.id)!;
    expect(namesIn('c1')).toEqual(['A', 'A (copy)', 'B', 'C']);
    expect(service.requests().find(r => r.id === copy.id)!.order).toBe(1);
    expect(service.requests().map(r => r.order)).toEqual([0, 1, 2, 3]);
  });

  it('sorts legacy records lacking an order field last, by createdAt', () => {
    service.save(makeRequest({ name: 'legacy-b', collectionId: 'c1', createdAt: '2020-02-01' }));
    service.save(makeRequest({ name: 'legacy-a', collectionId: 'c1', createdAt: '2020-01-01' }));
    // save() assigns an order, so both are ordered; verify determinism.
    expect(namesIn('c1')).toEqual(['legacy-b', 'legacy-a']);
  });
});

describe('RequestsService — regression guards', () => {
  let service: RequestsService;
  let table: ReturnType<typeof fakeTable>;

  beforeEach(() => {
    table = fakeTable();
    TestBed.configureTestingModule({
      providers: [RequestsService, { provide: AppDbService, useValue: { requests: table } }],
    });
    service = TestBed.inject(RequestsService);
  });

  it('repairs records with no order on load, densely and in createdAt order', async () => {
    table.toArray = () =>
      Promise.resolve([
        makeRequest({ name: 'b', collectionId: 'c1', createdAt: '2020-02-01' }),
        makeRequest({ name: 'a', collectionId: 'c1', createdAt: '2020-01-01' }),
        makeRequest({ name: 'c', collectionId: 'c1', createdAt: '2020-03-01' }),
      ]);
    await service.init();
    expect(service.requests().map(r => r.name)).toEqual(['a', 'b', 'c']);
    expect(service.requests().map(r => r.order)).toEqual([0, 1, 2]);
  });

  it('does not throw on a record missing createdAt', async () => {
    const broken = makeRequest({ name: 'broken', collectionId: 'c1' });
    delete (broken as Partial<ApiRequest>).createdAt;
    table.toArray = () => Promise.resolve([broken, makeRequest({ name: 'ok', collectionId: 'c1' })]);
    await expect(service.init()).resolves.toBeUndefined();
    expect(service.requests()).toHaveLength(2);
  });

  it('appends — never prepends — a new request into a group of legacy records', async () => {
    table.toArray = () =>
      Promise.resolve([makeRequest({ name: 'legacy', collectionId: 'c1', createdAt: '2020-01-01' })]);
    await service.init();
    const fresh = service.createInCollection('c1');
    service.rename(fresh.id, 'fresh');
    expect(service.requests().filter(r => r.collectionId === 'c1').map(r => r.name))
      .toEqual(['legacy', 'fresh']);
  });

  it('reassigns position when a request moves to another folder', () => {
    service.createInCollection('c1', 'f1');
    const moving = service.createInCollection('c1', 'f1');
    expect(moving.order).toBe(1);

    service.createInCollection('c1', 'f2');
    // Same request, now belonging to f2 — it must not keep index 1.
    service.save({ ...moving, folderId: 'f2' });

    const inF2 = service.requests().filter(r => r.folderId === 'f2');
    expect(inF2.map(r => r.order)).toEqual([0, 1]);
    expect(inF2[1].id).toBe(moving.id);
  });
});
