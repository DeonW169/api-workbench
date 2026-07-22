import { applyAuth } from './auth';
import { ApiRequest } from '../../shared/models/api-request.model';

function makeRequest(patch: Partial<ApiRequest> = {}): ApiRequest {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id: 'req-1',
    name: 'Test',
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

const authHeader = (r: ApiRequest) => r.headers.find(h => h.key === 'Authorization')?.value;

describe('applyAuth', () => {
  it('returns the request untouched for type none', () => {
    const req = makeRequest();
    expect(applyAuth(req)).toBe(req);
  });

  it('adds a bearer Authorization header', () => {
    const r = applyAuth(makeRequest({ auth: { type: 'bearer', bearerToken: 'abc' } }));
    expect(authHeader(r)).toBe('Bearer abc');
  });

  it('ignores a bearer auth with an empty token', () => {
    const r = applyAuth(makeRequest({ auth: { type: 'bearer', bearerToken: '' } }));
    expect(authHeader(r)).toBeUndefined();
  });

  it('base64-encodes basic credentials', () => {
    const r = applyAuth(makeRequest({ auth: { type: 'basic', username: 'user', password: 'pass' } }));
    expect(authHeader(r)).toBe(`Basic ${btoa('user:pass')}`);
  });

  it('adds an api key as a header', () => {
    const r = applyAuth(
      makeRequest({
        auth: { type: 'apiKey', apiKeyKey: 'X-Key', apiKeyValue: 'v', apiKeyLocation: 'header' },
      }),
    );
    expect(r.headers.find(h => h.key === 'X-Key')?.value).toBe('v');
    expect(r.queryParams).toHaveLength(0);
  });

  it('adds an api key as a query param', () => {
    const r = applyAuth(
      makeRequest({
        auth: { type: 'apiKey', apiKeyKey: 'key', apiKeyValue: 'v', apiKeyLocation: 'query' },
      }),
    );
    expect(r.queryParams.find(p => p.key === 'key')?.value).toBe('v');
    expect(r.headers).toHaveLength(0);
  });

  it('preserves pre-existing headers', () => {
    const r = applyAuth(
      makeRequest({
        headers: [{ key: 'X-Existing', value: '1', enabled: true }],
        auth: { type: 'bearer', bearerToken: 'abc' },
      }),
    );
    expect(r.headers).toHaveLength(2);
  });

  it('never mutates the original request', () => {
    const original = makeRequest({ auth: { type: 'bearer', bearerToken: 'abc' } });
    applyAuth(original);
    expect(original.headers).toHaveLength(0);
  });

  // ── D7 (fixed) ────────────────────────────────────────────────────────────
  it('encodes non-latin1 basic credentials as UTF-8 instead of throwing', () => {
    const r = applyAuth(
      makeRequest({ auth: { type: 'basic', username: 'user', password: 'pässwörd€' } }),
    );
    const encoded = authHeader(r)!.replace(/^Basic /, '');
    expect(new TextDecoder().decode(Uint8Array.from(atob(encoded), c => c.charCodeAt(0))))
      .toBe('user:pässwörd€');
  });

  it('still matches btoa for pure-ASCII credentials', () => {
    const r = applyAuth(makeRequest({ auth: { type: 'basic', username: 'u', password: 'p' } }));
    expect(authHeader(r)).toBe(`Basic ${btoa('u:p')}`);
  });
});
