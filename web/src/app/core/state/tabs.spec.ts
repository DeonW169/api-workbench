import { TabsService } from './tabs';
import { ApiRequest } from '../../shared/models/api-request.model';

function makeRequest(patch: Partial<ApiRequest> = {}): ApiRequest {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id: 'req-1',
    name: 'Saved Request',
    method: 'GET',
    url: 'https://x.com/a',
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

describe('TabsService — D11: dirty tracking', () => {
  let tabs: TabsService;
  beforeEach(() => {
    tabs = new TabsService();
  });

  it('starts clean', () => {
    expect(tabs.activeTab()!.isDirty).toBe(false);
  });

  it('marks an unsaved draft dirty once content changes', () => {
    tabs.updateActiveRequest(makeRequest({ url: 'https://changed.com' }));
    expect(tabs.activeTab()!.isDirty).toBe(true);
  });

  it('marks a saved request dirty when the url changes', () => {
    tabs.openRequest(makeRequest());
    tabs.updateActiveRequest(makeRequest({ url: 'https://changed.com' }));
    expect(tabs.activeTab()!.isDirty).toBe(true);
  });

  it('marks the tab dirty when only assertions change', () => {
    tabs.openRequest(makeRequest());
    tabs.updateActiveRequest(
      makeRequest({ assertions: [{ id: 'a1', enabled: true, type: 'statusEquals', expected: 200 }] }),
    );
    expect(tabs.activeTab()!.isDirty).toBe(true);
  });

  it('marks the tab dirty when only per-request variables change', () => {
    tabs.openRequest(makeRequest());
    tabs.updateActiveRequest(makeRequest({ variables: [{ key: 'k', value: 'v', enabled: true }] }));
    expect(tabs.activeTab()!.isDirty).toBe(true);
  });

  it('stays clean when only non-content metadata changes', () => {
    tabs.openRequest(makeRequest());
    tabs.updateActiveRequest(makeRequest({ name: 'Renamed', updatedAt: 'later' }));
    expect(tabs.activeTab()!.isDirty).toBe(false);
  });

  it('clears dirty after markTabSaved', () => {
    tabs.openRequest(makeRequest());
    const changed = makeRequest({ url: 'https://changed.com' });
    tabs.updateActiveRequest(changed);
    tabs.markTabSaved(tabs.activeTab()!.id, changed);
    expect(tabs.activeTab()!.isDirty).toBe(false);
  });
});

describe('TabsService — tab lifecycle', () => {
  let tabs: TabsService;
  beforeEach(() => {
    tabs = new TabsService();
  });

  it('activates an existing tab rather than duplicating it', () => {
    tabs.openRequest(makeRequest());
    const count = tabs.tabs().length;
    tabs.openRequest(makeRequest());
    expect(tabs.tabs()).toHaveLength(count);
  });

  it('always keeps at least one tab open', () => {
    tabs.closeTab(tabs.activeTab()!.id);
    expect(tabs.tabs()).toHaveLength(1);
  });

  it('activates the tab to the left after closing the active one', () => {
    const first = tabs.activeTab()!.id;
    tabs.openRequest(makeRequest({ id: 'r2' }));
    const second = tabs.activeTabId();
    tabs.closeTab(second);
    expect(tabs.activeTabId()).toBe(first);
  });
});
