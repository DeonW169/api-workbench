import { VariableMap } from './variable-resolver';

// ── Supported dynamic variable names ─────────────────────────────────────────

/**
 * All built-in dynamic variable names (without the surrounding {{ }}).
 * These are generated fresh on every request execution.
 */
export const DYNAMIC_VAR_NAMES = [
  '$timestamp',
  '$isoDatetime',
  '$uuid',
  '$randomInt',
  '$randomString',
  '$date',
] as const;

export type DynamicVarName = (typeof DYNAMIC_VAR_NAMES)[number];

// ── Generator ─────────────────────────────────────────────────────────────────

/**
 * Build a VariableMap snapshot of all dynamic variables.
 *
 * Values are generated **once per call**, so every occurrence of e.g.
 * `{{$uuid}}` within the same request resolves to the same value — useful
 * when you need the same ID in both the URL and the body.
 *
 * User-defined variables with identical names always take precedence when
 * the caller merges this map (put it first in `mergeVars()`).
 *
 * | Placeholder       | Example value                            |
 * |-------------------|------------------------------------------|
 * | `$timestamp`      | `1741132800`                             |
 * | `$isoDatetime`    | `2026-03-05T08:00:00.000Z`               |
 * | `$uuid`           | `4b9d6e8a-…`                             |
 * | `$randomInt`      | `471829`  (0 – 999 999, inclusive)       |
 * | `$randomString`   | `k3mZpQwLnT`  (10 alphanumeric chars)    |
 * | `$date`           | `2026-03-05`                             |
 */
export function buildDynamicVarMap(): VariableMap {
  const now = new Date();
  return {
    $timestamp:    String(Math.floor(now.getTime() / 1_000)),
    $isoDatetime:  now.toISOString(),
    $uuid:         crypto.randomUUID(),
    $randomInt:    String(Math.floor(Math.random() * 1_000_000)),
    $randomString: randomAlphanumeric(10),
    $date:         now.toISOString().slice(0, 10),
  };
}

// ── Private helpers ───────────────────────────────────────────────────────────

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomAlphanumeric(length: number): string {
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  return Array.from(buf, n => CHARSET[n % CHARSET.length]).join('');
}
