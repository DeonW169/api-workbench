import { resolveRequest } from './variable-resolver';
import { applyAuth } from './auth';
import { generateCurl } from './curl-generator';
import { ApiRequest } from '../../shared/models/api-request.model';

/**
 * D1 end-to-end: the resolve -> applyAuth pipeline used by both
 * WorkspaceService.execute() and CollectionRunnerService.executeOne().
 * Previously `Bearer {{token}}` was sent to the wire verbatim.
 */

function makeRequest(patch: Partial<ApiRequest> = {}): ApiRequest {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id: 'req-1',
    name: 'Test',
    method: 'GET',
    url: '{{baseUrl}}/me',
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

const vars = { baseUrl: 'https://api.acme.com', token: 'SECRET123', keyName: 'X-Api-Key' };
const pipeline = (req: ApiRequest) => applyAuth(resolveRequest(req, vars));
const authHeader = (r: ApiRequest) => r.headers.find(h => h.key === 'Authorization')?.value;

describe('D1: resolve -> applyAuth end to end', () => {
  it('sends a resolved bearer token, not the placeholder', () => {
    const sent = pipeline(makeRequest({ auth: { type: 'bearer', bearerToken: '{{token}}' } }));
    expect(sent.url).toBe('https://api.acme.com/me');
    expect(authHeader(sent)).toBe('Bearer SECRET123');
    expect(authHeader(sent)).not.toContain('{{');
  });

  it('sends resolved basic credentials', () => {
    const sent = pipeline(
      makeRequest({ auth: { type: 'basic', username: 'admin', password: '{{token}}' } }),
    );
    expect(authHeader(sent)).toBe(`Basic ${btoa('admin:SECRET123')}`);
  });

  it('resolves an api key in both name and value, as a header', () => {
    const sent = pipeline(
      makeRequest({
        auth: {
          type: 'apiKey',
          apiKeyKey: '{{keyName}}',
          apiKeyValue: '{{token}}',
          apiKeyLocation: 'header',
        },
      }),
    );
    expect(sent.headers.find(h => h.key === 'X-Api-Key')?.value).toBe('SECRET123');
  });

  it('resolves an api key placed in the query string', () => {
    const sent = pipeline(
      makeRequest({
        auth: {
          type: 'apiKey',
          apiKeyKey: '{{keyName}}',
          apiKeyValue: '{{token}}',
          apiKeyLocation: 'query',
        },
      }),
    );
    expect(sent.queryParams.find(p => p.key === 'X-Api-Key')?.value).toBe('SECRET123');
  });

  it('exports cURL with resolved credentials and no duplicated header', () => {
    // cURL export consumes the resolved-but-not-applied request.
    const resolved = resolveRequest(
      makeRequest({ auth: { type: 'bearer', bearerToken: '{{token}}' } }),
      vars,
    );
    const cmd = generateCurl(resolved);
    expect(cmd).toContain('Authorization: Bearer SECRET123');
    expect(cmd.match(/Authorization/g)).toHaveLength(1);
  });
});
