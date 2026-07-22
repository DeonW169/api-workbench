import { AssertionService } from './assertion.service';
import { Assertion } from '../../shared/models/assertion.model';
import { ApiResponse } from '../../shared/models/api-response.model';

function makeResponse(patch: Partial<ApiResponse> = {}): ApiResponse {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    durationMs: 12,
    headers: { 'Content-Type': 'application/json' },
    body: { user: { id: 7, name: 'ada' }, items: [1, 2], active: true },
    contentType: 'application/json',
    size: 42,
    ...patch,
  };
}

const service = new AssertionService();

/** An assertion minus the base fields — `Omit` would collapse the union. */
type AssertionSpec =
  | { type: 'statusEquals'; expected: number }
  | { type: 'bodyContains'; substring: string }
  | { type: 'headerExists'; header: string }
  | { type: 'jsonPathExists'; path: string }
  | { type: 'jsonPathEquals'; path: string; expected: string };

const withId = (a: AssertionSpec): Assertion => ({ id: 'a1', enabled: true, ...a });

describe('AssertionService.evaluate', () => {
  it('skips disabled assertions entirely', () => {
    const summary = service.evaluate(
      [{ id: 'a1', enabled: false, type: 'statusEquals', expected: 999 }],
      makeResponse(),
    );
    expect(summary).toMatchObject({ total: 0, passed: 0, failed: 0 });
    expect(summary.results).toHaveLength(0);
  });

  it('tallies a mix of passes and failures', () => {
    const summary = service.evaluate(
      [
        { id: 'a1', enabled: true, type: 'statusEquals', expected: 200 },
        { id: 'a2', enabled: true, type: 'statusEquals', expected: 404 },
      ],
      makeResponse(),
    );
    expect(summary).toMatchObject({ total: 2, passed: 1, failed: 1 });
  });
});

describe('statusEquals', () => {
  it('passes on an exact match', () => {
    const r = service.evaluate([withId({ type: 'statusEquals', expected: 200 })], makeResponse());
    expect(r.results[0].passed).toBe(true);
  });

  it('fails and reports the actual status', () => {
    const r = service.evaluate(
      [withId({ type: 'statusEquals', expected: 200 })],
      makeResponse({ status: 404 }),
    );
    expect(r.results[0].passed).toBe(false);
    expect(r.results[0].message).toContain('404');
  });
});

describe('bodyContains', () => {
  it('searches inside a stringified object body', () => {
    const r = service.evaluate([withId({ type: 'bodyContains', substring: 'ada' })], makeResponse());
    expect(r.results[0].passed).toBe(true);
  });

  it('searches a plain string body', () => {
    const r = service.evaluate(
      [withId({ type: 'bodyContains', substring: 'hello' })],
      makeResponse({ body: 'well hello there' }),
    );
    expect(r.results[0].passed).toBe(true);
  });

  it('fails when the substring is absent', () => {
    const r = service.evaluate(
      [withId({ type: 'bodyContains', substring: 'nope' })],
      makeResponse(),
    );
    expect(r.results[0].passed).toBe(false);
  });
});

describe('headerExists', () => {
  it('matches case-insensitively', () => {
    const r = service.evaluate(
      [withId({ type: 'headerExists', header: 'content-type' })],
      makeResponse(),
    );
    expect(r.results[0].passed).toBe(true);
  });

  it('fails for an absent header', () => {
    const r = service.evaluate([withId({ type: 'headerExists', header: 'X-Nope' })], makeResponse());
    expect(r.results[0].passed).toBe(false);
  });
});

describe('jsonPathExists', () => {
  it.each([
    ['$.user.id', true],
    ['$.items[1]', true],
    ['$.user.missing', false],
  ])('%s -> %s', (path, expected) => {
    const r = service.evaluate([withId({ type: 'jsonPathExists', path })], makeResponse());
    expect(r.results[0].passed).toBe(expected);
  });
});

describe('jsonPathEquals', () => {
  it('coerces to string so "7" matches the number 7', () => {
    const r = service.evaluate(
      [withId({ type: 'jsonPathEquals', path: '$.user.id', expected: '7' })],
      makeResponse(),
    );
    expect(r.results[0].passed).toBe(true);
  });

  it('compares booleans as strings', () => {
    const r = service.evaluate(
      [withId({ type: 'jsonPathEquals', path: '$.active', expected: 'true' })],
      makeResponse(),
    );
    expect(r.results[0].passed).toBe(true);
  });

  it('fails with both expected and actual in the message', () => {
    const r = service.evaluate(
      [withId({ type: 'jsonPathEquals', path: '$.user.name', expected: 'bob' })],
      makeResponse(),
    );
    expect(r.results[0].passed).toBe(false);
    expect(r.results[0].message).toContain('bob');
    expect(r.results[0].message).toContain('ada');
  });

  it('fails cleanly when the path does not exist', () => {
    const r = service.evaluate(
      [withId({ type: 'jsonPathEquals', path: '$.nope', expected: 'x' })],
      makeResponse(),
    );
    expect(r.results[0].passed).toBe(false);
    expect(r.results[0].message).toContain('does not exist');
  });
});
