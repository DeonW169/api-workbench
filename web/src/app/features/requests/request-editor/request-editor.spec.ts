import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RequestEditor } from './request-editor';
import { ApiRequest } from '../../../shared/models/api-request.model';

function makeRequest(patch: Partial<ApiRequest> = {}): ApiRequest {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id: 'req-1',
    name: 'Saved Request',
    method: 'GET',
    url: 'https://api.example.com/users',
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

@Component({
  imports: [RequestEditor],
  template: `<app-request-editor [requestToLoad]="toLoad()" (requestChange)="emitted = $event" />`,
})
class Host {
  readonly toLoad = signal<ApiRequest | null>(null);
  emitted: ApiRequest | null = null;
}

async function loadIntoEditor(req: ApiRequest): Promise<ApiRequest> {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.toLoad.set(req);
  await fixture.whenStable();
  return fixture.componentInstance.emitted!;
}

describe('RequestEditor — D2: ownership fields survive a round trip', () => {
  it('preserves collectionId and folderId', async () => {
    const emitted = await loadIntoEditor(
      makeRequest({ collectionId: 'coll-1', folderId: 'folder-1' }),
    );
    expect(emitted.collectionId).toBe('coll-1');
    expect(emitted.folderId).toBe('folder-1');
  });

  it('preserves per-request variable overrides', async () => {
    const vars = [{ key: 'k', value: 'v', enabled: true }];
    expect((await loadIntoEditor(makeRequest({ variables: vars }))).variables).toEqual(vars);
  });

  it('preserves identity and creation timestamp', async () => {
    const emitted = await loadIntoEditor(makeRequest());
    expect(emitted.id).toBe('req-1');
    expect(emitted.name).toBe('Saved Request');
    expect(emitted.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('still emits the editable fields', async () => {
    const emitted = await loadIntoEditor(
      makeRequest({
        method: 'POST',
        url: 'https://x.com/a',
        bodyType: 'json',
        bodyRaw: '{"a":1}',
        headers: [{ key: 'X-A', value: 'b', enabled: true }],
        auth: { type: 'bearer', bearerToken: 'tok' },
      }),
    );
    expect(emitted).toMatchObject({
      method: 'POST',
      url: 'https://x.com/a',
      bodyType: 'json',
      bodyRaw: '{"a":1}',
    });
    expect(emitted.headers).toEqual([{ key: 'X-A', value: 'b', enabled: true }]);
    expect(emitted.auth).toEqual({ type: 'bearer', bearerToken: 'tok' });
  });

  it('carries ownership across a switch between two requests', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.toLoad.set(makeRequest({ id: 'a', collectionId: 'c1', folderId: 'f1' }));
    await fixture.whenStable();

    // Identical editable fields — only the ownership metadata differs.
    fixture.componentInstance.toLoad.set(makeRequest({ id: 'b', collectionId: 'c2', folderId: 'f2' }));
    await fixture.whenStable();

    expect(fixture.componentInstance.emitted).toMatchObject({
      id: 'b',
      collectionId: 'c2',
      folderId: 'f2',
    });
  });

  it('emits a stable snapshot when read repeatedly (pure computed)', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.toLoad.set(makeRequest());
    await fixture.whenStable();
    const first = fixture.componentInstance.emitted!;
    await fixture.whenStable();
    expect(fixture.componentInstance.emitted!.updatedAt).toBe(first.updatedAt);
  });
});
