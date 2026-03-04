import { ApiRequest } from '../../shared/models/api-request.model';
import { EnvironmentModel } from '../../shared/models/environment.model';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Flat lookup of variable name → resolved string value. */
export type VariableMap = Record<string, string>;

/**
 * A variable-resolved copy of ApiRequest ready for HTTP execution.
 *
 * Structurally identical to ApiRequest; the distinct type alias communicates
 * that all {{placeholders}} have been substituted and the object must not be
 * produced by hand — use resolveRequest() or VariableResolverService.
 */
export type ResolvedRequest = ApiRequest;

// ── Pattern ───────────────────────────────────────────────────────────────────

/**
 * Matches Postman-style {{variableName}} placeholders.
 * Allows optional whitespace around the name; names may contain
 * word chars, dots, and hyphens (e.g. {{base.url}}, {{auth-token}}).
 */
const PLACEHOLDER = /\{\{(\s*[\w.-]+\s*)\}\}/g;

// ── Core primitives ───────────────────────────────────────────────────────────

/**
 * Replace all {{key}} placeholders in a single string.
 *
 * Keys with no entry in vars are left as-is — this intentionally distinguishes
 * "variable set to empty string" from "variable not defined", and lets callers
 * detect unresolved references by their remaining {{…}} tokens.
 */
export function resolveString(input: string, vars: VariableMap): string {
  return input.replace(PLACEHOLDER, (match, raw: string) => {
    const key = raw.trim();
    return Object.hasOwn(vars, key) ? vars[key] : match;
  });
}

/**
 * Merge one or more VariableMaps left-to-right.
 * Later sources win on key collision, establishing an explicit precedence order.
 *
 * @example
 *   // environment overridden by request-level vars
 *   const merged = mergeVars(envMap, requestOverrides);
 */
export function mergeVars(...sources: VariableMap[]): VariableMap {
  return Object.assign({}, ...sources);
}

/**
 * Produce a fully-resolved clone of an ApiRequest.
 * The original request is **never mutated**.
 *
 * Fields resolved:
 *   - url
 *   - queryParams[].value      (keys are kept literal)
 *   - headers[].value          (keys are kept literal)
 *   - bodyRaw
 *   - bodyFormFields[].value   (text fields only; file fields are passed through)
 */
export function resolveRequest(request: ApiRequest, vars: VariableMap): ResolvedRequest {
  const r = (s: string) => resolveString(s, vars);
  return {
    ...request,
    url:            r(request.url),
    queryParams:    request.queryParams.map(p => ({ ...p, value: r(p.value) })),
    headers:        request.headers.map(h => ({ ...h, value: r(h.value) })),
    bodyRaw:        r(request.bodyRaw),
    bodyFormFields: request.bodyFormFields.map(f =>
      f.type === 'file' ? f : { ...f, value: r(f.value) },
    ),
  };
}

// ── Variable map builders ─────────────────────────────────────────────────────

/**
 * Build a VariableMap from any array of `{ key, value, enabled }` variables.
 * Disabled entries and blank keys are excluded.
 *
 * Use this for globals, collection variables, and request-level overrides.
 */
export function buildVarMap(
  variables: { key: string; value: string; enabled: boolean }[],
): VariableMap {
  return Object.fromEntries(
    variables
      .filter(v => v.enabled && v.key.trim() !== '')
      .map(v => [v.key.trim(), v.value]),
  );
}

/**
 * Build a VariableMap from an EnvironmentModel.
 * Variables that are disabled or have a blank key are excluded.
 * Returns an empty map for null / undefined.
 */
export function buildEnvMap(env: EnvironmentModel | null | undefined): VariableMap {
  if (!env) return {};
  return buildVarMap(env.variables);
}

// ── Diagnostic helpers ────────────────────────────────────────────────────────

/**
 * Return all unique variable names referenced inside a string that have
 * no corresponding entry in vars.
 */
export function findUnresolvedInString(input: string, vars: VariableMap): Set<string> {
  const missing = new Set<string>();
  for (const [, raw] of input.matchAll(new RegExp(PLACEHOLDER.source, 'g'))) {
    const key = raw.trim();
    if (!Object.hasOwn(vars, key)) missing.add(key);
  }
  return missing;
}

/**
 * Return the set of {{variable}} names referenced across all resolvable
 * fields of a request that cannot be satisfied by vars.
 *
 * Use this to drive "missing variable" warnings in the UI before executing.
 */
export function findUnresolvedVars(request: ApiRequest, vars: VariableMap): Set<string> {
  const fields = [
    request.url,
    ...request.queryParams.map(p => p.value),
    ...request.headers.map(h => h.value),
    request.bodyRaw,
    // Text form fields only — file fields contain filenames, not variable expressions
    ...request.bodyFormFields.filter(f => f.type === 'text').map(f => f.value),
  ];

  const missing = new Set<string>();
  for (const field of fields) {
    for (const key of findUnresolvedInString(field, vars)) {
      missing.add(key);
    }
  }
  return missing;
}
