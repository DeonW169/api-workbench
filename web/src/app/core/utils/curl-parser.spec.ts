import { parseCurl, suggestName } from './curl-parser';
import { HTTP_METHODS } from '../../shared/models/api-request.model';

describe('parseCurl — rejection', () => {
  it.each([
    ['empty string', '   '],
    ['not a curl command', 'wget https://x.com'],
    ['curl with no url', 'curl -X POST'],
  ])('returns null for %s', (_label, cmd) => {
    expect(parseCurl(cmd)).toBeNull();
  });

  it('accepts a path-prefixed binary', () => {
    expect(parseCurl('/usr/bin/curl https://x.com/a')?.url).toBe('https://x.com/a');
  });
});

describe('parseCurl — method', () => {
  it('defaults to GET with no body', () => {
    expect(parseCurl('curl https://x.com/a')?.method).toBe('GET');
  });

  it('infers POST when a body is present', () => {
    expect(parseCurl(`curl -d 'a=1' https://x.com/a`)?.method).toBe('POST');
  });

  it('honours an explicit -X even with a body', () => {
    expect(parseCurl(`curl -X PUT -d 'a=1' https://x.com/a`)?.method).toBe('PUT');
  });
});

describe('parseCurl — url and query', () => {
  it('finds the url after flags', () => {
    expect(parseCurl(`curl -H 'A: b' https://x.com/a`)?.url).toBe('https://x.com/a');
  });

  it('ignores unknown boolean flags', () => {
    expect(parseCurl('curl -L -s -k --compressed https://x.com/a')?.url).toBe('https://x.com/a');
  });

  it('consumes the argument of ignored flags that take one', () => {
    expect(parseCurl('curl -o out.txt https://x.com/a')?.url).toBe('https://x.com/a');
  });

  it('splits the query string into params and strips it from the url', () => {
    const r = parseCurl(`curl 'https://x.com/a?p=1&z=2'`)!;
    expect(r.url).toBe('https://x.com/a');
    expect(r.queryParams).toEqual([
      { key: 'p', value: '1', enabled: true },
      { key: 'z', value: '2', enabled: true },
    ]);
  });

  it('preserves repeated query keys', () => {
    expect(parseCurl(`curl 'https://x.com/a?p=1&p=2'`)!.queryParams).toHaveLength(2);
  });
});

describe('parseCurl — headers and auth', () => {
  it('parses headers and keeps values containing colons', () => {
    expect(parseCurl(`curl -H 'X-Time: 10:30' https://x.com/a`)!.headers).toEqual([
      { key: 'X-Time', value: '10:30', enabled: true },
    ]);
  });

  it('lifts a bearer Authorization header into the auth model', () => {
    const r = parseCurl(`curl -H 'Authorization: Bearer abc123' https://x.com/a`)!;
    expect(r.auth).toEqual({ type: 'bearer', bearerToken: 'abc123' });
    expect(r.headers).toHaveLength(0);
  });

  it('decodes a basic Authorization header into username and password', () => {
    const encoded = btoa('user:pass');
    const r = parseCurl(`curl -H 'Authorization: Basic ${encoded}' https://x.com/a`)!;
    expect(r.auth).toEqual({ type: 'basic', username: 'user', password: 'pass' });
  });

  it('keeps an unrecognised Authorization scheme as a plain header', () => {
    const r = parseCurl(`curl -H 'Authorization: Digest xyz' https://x.com/a`)!;
    expect(r.auth.type).toBe('none');
    expect(r.headers).toHaveLength(1);
  });

  it('parses -u into basic auth', () => {
    expect(parseCurl(`curl -u 'user:pass' https://x.com/a`)!.auth).toEqual({
      type: 'basic',
      username: 'user',
      password: 'pass',
    });
  });
});

describe('parseCurl — body', () => {
  it('detects JSON from the content-type header', () => {
    const r = parseCurl(`curl -H 'Content-Type: application/json' -d '{"a":1}' https://x.com/a`)!;
    expect(r.bodyType).toBe('json');
    expect(r.bodyRaw).toBe('{"a":1}');
  });

  it('detects JSON by shape when no content-type is given', () => {
    expect(parseCurl(`curl -d '{"a":1}' https://x.com/a`)!.bodyType).toBe('json');
  });

  it('falls back to text for non-JSON bodies', () => {
    expect(parseCurl(`curl -d 'hello' https://x.com/a`)!.bodyType).toBe('text');
  });

  it('joins repeated -d flags with &', () => {
    expect(parseCurl(`curl -d 'a=1' -d 'b=2' https://x.com/a`)!.bodyRaw).toBe('a=1&b=2');
  });

  it('splits a urlencoded content-type body into fields', () => {
    const r = parseCurl(
      `curl -H 'Content-Type: application/x-www-form-urlencoded' -d 'a=1&b=2' https://x.com/a`,
    )!;
    expect(r.bodyType).toBe('x-www-form-urlencoded');
    expect(r.bodyFormFields.map(f => [f.key, f.value])).toEqual([['a', '1'], ['b', '2']]);
  });

  it('parses -F text fields and skips @file references', () => {
    const r = parseCurl(`curl -F 'file=@/tmp/a.png' -F 'name=x' https://x.com/a`)!;
    expect(r.bodyType).toBe('form-data');
    expect(r.bodyFormFields).toEqual([{ key: 'name', value: 'x', enabled: true, type: 'text' }]);
  });

  // ── D8 (fixed) ────────────────────────────────────────────────────────────
  it('keeps a --data-urlencode field whose value contains @', () => {
    const r = parseCurl(`curl --data-urlencode 'email=a@b.com' https://x.com/a`)!;
    expect(r.method).toBe('POST');
    expect(r.bodyType).toBe('x-www-form-urlencoded');
    expect(r.bodyFormFields).toEqual([
      { key: 'email', value: 'a@b.com', enabled: true, type: 'text' },
    ]);
  });

  it('still skips genuine --data-urlencode @file references', () => {
    expect(parseCurl(`curl --data-urlencode '@payload.txt' https://x.com/a`)!.bodyFormFields)
      .toHaveLength(0);
    expect(parseCurl(`curl --data-urlencode 'name@payload.txt' https://x.com/a`)!.bodyFormFields)
      .toHaveLength(0);
  });
});

describe('parseCurl — D8: -G support', () => {
  it('turns -d data into query params on a GET', () => {
    const r = parseCurl(`curl -G -d 'q=1' https://x.com/a`)!;
    expect(r.method).toBe('GET');
    expect(r.bodyType).toBe('none');
    expect(r.queryParams).toEqual([{ key: 'q', value: '1', enabled: true }]);
  });

  it('merges -G data with params already in the url', () => {
    const r = parseCurl(`curl --get -d 'b=2' 'https://x.com/a?a=1'`)!;
    expect(r.queryParams).toEqual([
      { key: 'a', value: '1', enabled: true },
      { key: 'b', value: '2', enabled: true },
    ]);
  });

  it('moves --data-urlencode fields into the query string under -G', () => {
    const r = parseCurl(`curl -G --data-urlencode 'email=a@b.com' https://x.com/a`)!;
    expect(r.queryParams).toEqual([{ key: 'email', value: 'a@b.com', enabled: true }]);
    expect(r.bodyType).toBe('none');
  });

  it('lets an explicit -X override the GET implied by -G', () => {
    expect(parseCurl(`curl -G -X HEAD -d 'q=1' https://x.com/a`)!.method).toBe('HEAD');
  });
});

describe('parseCurl — D8: method alignment', () => {
  it('only ever produces a method the model declares', () => {
    for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
      expect(HTTP_METHODS).toContain(parseCurl(`curl -X ${m} https://x.com/a`)!.method);
    }
  });

  it('falls back to a default for an unknown method rather than inventing one', () => {
    const r = parseCurl(`curl -X TRACE https://x.com/a`)!;
    expect(HTTP_METHODS).toContain(r.method);
    expect(r.method).toBe('GET');
  });
});

describe('parseCurl — tokenizer', () => {
  it('handles double quotes with escaped inner quotes', () => {
    const r = parseCurl(`curl -X POST -H "Content-Type: application/json" -d "{\\"a\\":1}" https://x.com/a`)!;
    expect(r.bodyRaw).toBe('{"a":1}');
  });

  it('collapses line continuations', () => {
    const r = parseCurl(`curl https://x.com/a \\\n  -H 'A: b' \\\n  -d 'c=1'`)!;
    expect(r.url).toBe('https://x.com/a');
    expect(r.headers).toEqual([{ key: 'A', value: 'b', enabled: true }]);
    expect(r.bodyRaw).toBe('c=1');
  });

  it("handles the '\\'' embedded-single-quote idiom", () => {
    expect(parseCurl(`curl -d 'it'\\''s' https://x.com/a`)!.bodyRaw).toBe("it's");
  });
});

describe('suggestName', () => {
  it('builds a label from method, host and path', () => {
    expect(suggestName('GET', 'https://api.example.com/users/123')).toBe(
      'GET api.example.com/users/123',
    );
  });

  it('falls back gracefully for an unparseable url', () => {
    expect(suggestName('GET', ':::')).toContain('GET');
  });
});
