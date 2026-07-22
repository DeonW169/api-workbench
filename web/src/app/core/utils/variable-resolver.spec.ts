import {
  buildEnvMap,
  buildVarMap,
  findUnresolvedVars,
  mergeVars,
  resolveRequest,
  resolveString,
} from './variable-resolver';
import { ApiRequest } from '../../shared/models/api-request.model';

function makeRequest(patch: Partial<ApiRequest> = {}): ApiRequest {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id: 'req-1',
    name: 'Test',
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

describe('resolveString', () => {
  it('substitutes a known placeholder', () => {
    expect(resolveString('{{a}}/x', { a: 'A' })).toBe('A/x');
  });

  it('tolerates whitespace inside the braces', () => {
    expect(resolveString('{{  a  }}', { a: 'A' })).toBe('A');
  });

  it.each([
    ['dots', '{{base.url}}', { 'base.url': 'B' }],
    ['hyphens', '{{auth-token}}', { 'auth-token': 'B' }],
    ['underscores', '{{my_var}}', { my_var: 'B' }],
    ['dynamic $ prefix', '{{$uuid}}', { $uuid: 'B' }],
  ])('supports %s in variable names', (_label, input, vars) => {
    expect(resolveString(input, vars)).toBe('B');
  });

  it('leaves unknown placeholders intact so they stay detectable', () => {
    expect(resolveString('{{a}}/{{b}}', { a: 'A' })).toBe('A/{{b}}');
  });

  it('distinguishes an empty-string value from an undefined variable', () => {
    expect(resolveString('[{{a}}]', { a: '' })).toBe('[]');
    expect(resolveString('[{{a}}]', {})).toBe('[{{a}}]');
  });

  it('substitutes every occurrence', () => {
    expect(resolveString('{{a}}-{{a}}', { a: 'A' })).toBe('A-A');
  });

  it('does not resolve recursively (documented limitation)', () => {
    expect(resolveString('{{a}}', { a: '{{b}}', b: 'final' })).toBe('{{b}}');
  });
});

describe('mergeVars', () => {
  it('lets later sources win on collision', () => {
    expect(mergeVars({ a: '1', b: '1' }, { b: '2' })).toEqual({ a: '1', b: '2' });
  });
});

describe('buildVarMap', () => {
  it('excludes disabled rows and blank keys, and trims keys', () => {
    expect(
      buildVarMap([
        { key: 'a', value: '1', enabled: true },
        { key: 'b', value: '2', enabled: false },
        { key: '   ', value: '3', enabled: true },
        { key: '  c  ', value: '4', enabled: true },
      ]),
    ).toEqual({ a: '1', c: '4' });
  });

  it('returns an empty map for a null environment', () => {
    expect(buildEnvMap(null)).toEqual({});
  });
});

describe('resolveRequest', () => {
  const vars = { host: 'api.acme.com', token: 'SECRET', q: 'search' };

  it('resolves url, query values, header values, body and text form fields', () => {
    const resolved = resolveRequest(
      makeRequest({
        url: 'https://{{host}}/v1',
        queryParams: [{ key: 'q', value: '{{q}}', enabled: true }],
        headers: [{ key: 'X-Token', value: '{{token}}', enabled: true }],
        bodyType: 'json',
        bodyRaw: '{"t":"{{token}}"}',
        bodyFormFields: [{ key: 'f', value: '{{q}}', enabled: true, type: 'text' }],
      }),
      vars,
    );

    expect(resolved.url).toBe('https://api.acme.com/v1');
    expect(resolved.queryParams[0].value).toBe('search');
    expect(resolved.headers[0].value).toBe('SECRET');
    expect(resolved.bodyRaw).toBe('{"t":"SECRET"}');
    expect(resolved.bodyFormFields[0].value).toBe('search');
  });

  it('keeps keys literal', () => {
    const resolved = resolveRequest(
      makeRequest({ headers: [{ key: '{{host}}', value: 'v', enabled: true }] }),
      vars,
    );
    expect(resolved.headers[0].key).toBe('{{host}}');
  });

  it('passes file form fields through untouched', () => {
    const file = { key: 'f', value: '{{q}}.png', enabled: true, type: 'file' as const, fileContent: 'AAA' };
    const resolved = resolveRequest(makeRequest({ bodyFormFields: [file] }), vars);
    expect(resolved.bodyFormFields[0]).toEqual(file);
  });

  it('never mutates the original request', () => {
    const original = makeRequest({ url: 'https://{{host}}/v1' });
    const snapshot = JSON.stringify(original);
    resolveRequest(original, vars);
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  // ── D1 (fixed) ────────────────────────────────────────────────────────────
  it('resolves a bearer token', () => {
    const resolved = resolveRequest(
      makeRequest({ auth: { type: 'bearer', bearerToken: '{{token}}' } }),
      vars,
    );
    expect(resolved.auth.bearerToken).toBe('SECRET');
  });

  it('resolves basic auth credentials', () => {
    const resolved = resolveRequest(
      makeRequest({ auth: { type: 'basic', username: '{{q}}', password: '{{token}}' } }),
      vars,
    );
    expect(resolved.auth).toMatchObject({ username: 'search', password: 'SECRET' });
  });

  it('resolves both halves of an api key', () => {
    const resolved = resolveRequest(
      makeRequest({
        auth: { type: 'apiKey', apiKeyKey: '{{q}}', apiKeyValue: '{{token}}', apiKeyLocation: 'query' },
      }),
      vars,
    );
    expect(resolved.auth).toMatchObject({
      apiKeyKey: 'search',
      apiKeyValue: 'SECRET',
      apiKeyLocation: 'query',
    });
  });

  it('leaves undefined auth fields undefined rather than stringifying them', () => {
    const resolved = resolveRequest(makeRequest({ auth: { type: 'bearer' } }), vars);
    expect(resolved.auth.bearerToken).toBeUndefined();
    expect(resolved.auth.username).toBeUndefined();
  });

  it('does not disturb auth of type none', () => {
    expect(resolveRequest(makeRequest(), vars).auth).toEqual({ type: 'none' });
  });
});

describe('findUnresolvedVars', () => {
  it('reports names referenced across every resolvable field', () => {
    const missing = findUnresolvedVars(
      makeRequest({
        url: '{{a}}',
        queryParams: [{ key: 'k', value: '{{b}}', enabled: true }],
        headers: [{ key: 'k', value: '{{c}}', enabled: true }],
        bodyRaw: '{{d}}',
        bodyFormFields: [{ key: 'k', value: '{{e}}', enabled: true, type: 'text' }],
      }),
      {},
    );
    expect([...missing].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('reports nothing when every reference is satisfied', () => {
    expect(findUnresolvedVars(makeRequest({ url: '{{a}}' }), { a: '1' }).size).toBe(0);
  });

  // ── D1 (fixed) ────────────────────────────────────────────────────────────
  it('flags an unresolved bearer token', () => {
    const missing = findUnresolvedVars(
      makeRequest({ auth: { type: 'bearer', bearerToken: '{{token}}' } }),
      {},
    );
    expect([...missing]).toContain('token');
  });

  it('flags unresolved basic and api-key credentials', () => {
    expect([
      ...findUnresolvedVars(
        makeRequest({ auth: { type: 'basic', username: '{{u}}', password: '{{p}}' } }),
        {},
      ),
    ].sort()).toEqual(['p', 'u']);

    expect([
      ...findUnresolvedVars(
        makeRequest({ auth: { type: 'apiKey', apiKeyKey: '{{k}}', apiKeyValue: '{{v}}' } }),
        {},
      ),
    ].sort()).toEqual(['k', 'v']);
  });

  it('does not flag auth variables that resolve', () => {
    const missing = findUnresolvedVars(
      makeRequest({ auth: { type: 'bearer', bearerToken: '{{token}}' } }),
      { token: 'ok' },
    );
    expect(missing.size).toBe(0);
  });
});
