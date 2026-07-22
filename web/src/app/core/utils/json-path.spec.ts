import { evaluateJsonPath } from './json-path';

const doc = {
  a: { b: [1, 2] },
  'x-y': 5,
  arr: [{ n: 'q' }],
  nested: { deep: { value: null } },
  count: 0,
  flag: false,
};

describe('evaluateJsonPath', () => {
  it('returns the root for "$"', () => {
    expect(evaluateJsonPath(doc, '$')).toEqual({ found: true, value: doc });
  });

  it.each([
    ['$.a.b[1]', 2],
    ['$.a.b[0]', 1],
    ['$.x-y', 5],
    ["$['x-y']", 5],
    ['$["x-y"]', 5],
    ['$.arr[0].n', 'q'],
    ['$.a["b"][0]', 1],
    ['$.count', 0],
    ['$.flag', false],
    ['$.nested.deep.value', null],
  ])('resolves %s', (path, expected) => {
    expect(evaluateJsonPath(doc, path)).toEqual({ found: true, value: expected });
  });

  it.each([
    ['$.a.b[5]', 'array index out of bounds'],
    ['$.missing', 'missing key'],
    ['$.a.missing.deeper', 'traversing through a missing key'],
    ['$.x-y.nope', 'traversing into a number'],
    ['$.arr.n', 'object access on an array'],
    ['a.b', 'path not starting with $'],
    ['$..a', 'recursive descent (unsupported)'],
    ['$.a[*]', 'wildcard (unsupported)'],
    ['$.a.b[-1]', 'negative index'],
  ])('reports not-found for %s (%s)', path => {
    expect(evaluateJsonPath(doc, path)).toEqual({ found: false, value: undefined });
  });

  it('distinguishes a present null from a missing key', () => {
    expect(evaluateJsonPath(doc, '$.nested.deep.value').found).toBe(true);
    expect(evaluateJsonPath(doc, '$.nested.deep.absent').found).toBe(false);
  });

  it('does not treat inherited properties as found', () => {
    expect(evaluateJsonPath(doc, '$.toString').found).toBe(false);
  });

  it('handles a null or non-object root without throwing', () => {
    expect(evaluateJsonPath(null, '$.a').found).toBe(false);
    expect(evaluateJsonPath('a string', '$.a').found).toBe(false);
  });
});
