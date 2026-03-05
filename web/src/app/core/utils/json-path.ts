/**
 * Minimal JSONPath evaluator supporting the subset used by assertions:
 *
 *   $            — document root
 *   .key         — object property (any identifier)
 *   ["key"]      — object property (quoted, allows special chars)
 *   [n]          — array index (non-negative integer)
 *
 * Examples:
 *   $.status          → root.status
 *   $.user.id         → root.user.id
 *   $.items[0].name   → root.items[0].name
 *   $.data["@type"]   → root.data["@type"]
 *
 * No support for wildcards, recursive descent, or filter expressions.
 * Returns { found: false } for any path that cannot be traversed (wrong type,
 * missing key, out-of-bounds index, or syntax error).
 */

export interface JsonPathResult {
  found: boolean;
  value: unknown;
}

export function evaluateJsonPath(root: unknown, path: string): JsonPathResult {
  if (path === '$') return { found: true, value: root };
  if (!path.startsWith('$')) return { found: false, value: undefined };

  const segments = parseSegments(path.slice(1)); // strip leading '$'
  if (segments === null) return { found: false, value: undefined };

  let current: unknown = root;
  for (const seg of segments) {
    if (current === null || current === undefined) {
      return { found: false, value: undefined };
    }
    if (typeof seg === 'number') {
      if (!Array.isArray(current) || seg >= current.length || seg < 0) {
        return { found: false, value: undefined };
      }
      current = current[seg];
    } else {
      if (typeof current !== 'object' || Array.isArray(current)) {
        return { found: false, value: undefined };
      }
      const obj = current as Record<string, unknown>;
      if (!Object.hasOwn(obj, seg)) return { found: false, value: undefined };
      current = obj[seg];
    }
  }
  return { found: true, value: current };
}

// ── Path parser ───────────────────────────────────────────────────────────────

type Segment = string | number;

/**
 * Parse the path tail (everything after `$`) into an ordered list of segments.
 * Returns null if the path contains syntax we do not recognise.
 */
function parseSegments(tail: string): Segment[] | null {
  const segments: Segment[] = [];
  // Matches: .identifier | ["key"] | ['key'] | [n]
  const re = /\.([^.[]+)|\["([^"]+)"\]|\['([^']+)'\]|\[(\d+)\]/g;
  let last = 0;

  let match: RegExpExecArray | null;
  while ((match = re.exec(tail)) !== null) {
    if (match.index !== last) return null; // unrecognised syntax between matches
    last = re.lastIndex;

    if (match[1] !== undefined) segments.push(match[1]);            // .key
    else if (match[2] !== undefined) segments.push(match[2]);       // ["key"]
    else if (match[3] !== undefined) segments.push(match[3]);       // ['key']
    else if (match[4] !== undefined) segments.push(parseInt(match[4], 10)); // [n]
  }

  if (last !== tail.length) return null; // trailing unrecognised chars
  return segments;
}
