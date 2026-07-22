import { generateCurl } from './curl-generator';
import { parseCurl } from './curl-parser';
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

describe('generateCurl', () => {
  it('always states the method explicitly', () => {
    expect(generateCurl(makeRequest())).toContain('--request GET');
  });

  it('appends enabled query params and skips disabled ones', () => {
    const cmd = generateCurl(
      makeRequest({
        queryParams: [
          { key: 'a', value: '1', enabled: true },
          { key: 'b', value: '2', enabled: false },
        ],
      }),
    );
    expect(cmd).toContain('a=1');
    expect(cmd).not.toContain('b=2');
  });

  it('uses & when the url already has a query string', () => {
    const cmd = generateCurl(
      makeRequest({ url: 'https://x.com/a?z=0', queryParams: [{ key: 'a', value: '1', enabled: true }] }),
    );
    expect(cmd).toContain('?z=0&a=1');
  });

  it('emits an implicit JSON content-type', () => {
    const cmd = generateCurl(makeRequest({ bodyType: 'json', bodyRaw: '{"a":1}' }));
    expect(cmd).toContain("--header 'Content-Type: application/json'");
    expect(cmd).toContain(`--data-raw '{"a":1}'`);
  });

  it('does not duplicate an explicit content-type', () => {
    const cmd = generateCurl(
      makeRequest({
        bodyType: 'json',
        bodyRaw: '{}',
        headers: [{ key: 'Content-Type', value: 'application/vnd.api+json', enabled: true }],
      }),
    );
    expect(cmd.match(/Content-Type/g)).toHaveLength(1);
  });

  it('uses --user for basic auth and a header for bearer', () => {
    expect(generateCurl(makeRequest({ auth: { type: 'basic', username: 'u', password: 'p' } })))
      .toContain("--user 'u:p'");
    expect(generateCurl(makeRequest({ auth: { type: 'bearer', bearerToken: 't' } })))
      .toContain("--header 'Authorization: Bearer t'");
  });

  it('puts a query-located api key in the url, not a header', () => {
    const cmd = generateCurl(
      makeRequest({
        auth: { type: 'apiKey', apiKeyKey: 'key', apiKeyValue: 'v', apiKeyLocation: 'query' },
      }),
    );
    expect(cmd).toContain('key=v');
    expect(cmd).not.toContain('--header');
  });

  it('escapes embedded single quotes with the shell idiom', () => {
    expect(generateCurl(makeRequest({ bodyType: 'text', bodyRaw: "it's" })))
      .toContain(`'it'\\''s'`);
  });

  it('notes omitted file fields instead of silently dropping them', () => {
    const cmd = generateCurl(
      makeRequest({
        bodyType: 'form-data',
        bodyFormFields: [
          { key: 'name', value: 'x', enabled: true, type: 'text' },
          { key: 'avatar', value: 'a.png', enabled: true, type: 'file', fileContent: 'AAA' },
        ],
      }),
    );
    expect(cmd).toContain("--form 'name=x'");
    expect(cmd).toContain('file fields omitted');
    expect(cmd).toContain('avatar');
  });
});

describe('generateCurl -> parseCurl round trip', () => {
  it.each([
    ['simple GET', makeRequest()],
    ['GET with params', makeRequest({ queryParams: [{ key: 'a', value: '1', enabled: true }] })],
    ['POST json', makeRequest({ method: 'POST', bodyType: 'json', bodyRaw: '{"a":1}' })],
    ['PUT text', makeRequest({ method: 'PUT', bodyType: 'text', bodyRaw: 'hello' })],
    ['bearer auth', makeRequest({ auth: { type: 'bearer', bearerToken: 'tok' } })],
    ['custom header', makeRequest({ headers: [{ key: 'X-A', value: 'b', enabled: true }] })],
  ])('survives a round trip: %s', (_label, original) => {
    const reparsed = parseCurl(generateCurl(original))!;
    expect(reparsed).not.toBeNull();
    expect(reparsed.method).toBe(original.method);
    expect(reparsed.url).toBe('https://x.com/a');
    expect(reparsed.bodyType).toBe(original.bodyType);
    expect(reparsed.bodyRaw).toBe(original.bodyRaw);
    expect(reparsed.auth.type).toBe(original.auth.type);
  });
});
