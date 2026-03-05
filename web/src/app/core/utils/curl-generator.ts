import { ApiRequest } from '../../shared/models/api-request.model';

/**
 * Generate a human-readable cURL command from an ApiRequest.
 *
 * The request should be variable-resolved before calling this function
 * so that `{{placeholders}}` do not appear in the output.
 *
 * Auth is read directly from the `auth` field and translated to the
 * appropriate cURL flags:
 *   - bearer  → --header 'Authorization: Bearer …'
 *   - basic   → --user 'user:pass'
 *   - apiKey  → --header or appended to the URL (depending on location)
 *
 * form-data file fields are skipped (binary content cannot be represented
 * in a plain-text export); a comment is added when any are omitted.
 */
export function generateCurl(request: ApiRequest): string {
  const parts: string[] = [];

  // ── URL (with query params + apiKey-query auth) ───────────────────────────
  parts.push(`curl ${sq(buildUrl(request))}`);

  // ── Method ────────────────────────────────────────────────────────────────
  // Always explicit — makes the command self-documenting.
  parts.push(`  --request ${request.method}`);

  // ── Auth ──────────────────────────────────────────────────────────────────
  for (const line of authLines(request)) {
    parts.push(line);
  }

  // ── Headers ───────────────────────────────────────────────────────────────
  // Add implicit Content-Type for body types that require one, unless the user
  // already specified it.
  const hasContentType = request.headers
    .some(h => h.enabled && h.key.toLowerCase() === 'content-type');

  if (!hasContentType) {
    const implicit = implicitContentType(request);
    if (implicit) parts.push(`  --header ${sq(`Content-Type: ${implicit}`)}`);
  }

  for (const h of request.headers.filter(h => h.enabled && h.key)) {
    parts.push(`  --header ${sq(`${h.key}: ${h.value}`)}`);
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  for (const line of bodyLines(request)) {
    parts.push(line);
  }

  return parts.join(' \\\n');
}

// ── URL builder ───────────────────────────────────────────────────────────────

function buildUrl(request: ApiRequest): string {
  const params: Array<{ key: string; value: string }> = [
    ...request.queryParams.filter(p => p.enabled && p.key),
  ];

  // apiKey in query: not part of queryParams — handled here.
  const { auth } = request;
  if (
    auth.type === 'apiKey' &&
    auth.apiKeyKey &&
    auth.apiKeyValue &&
    auth.apiKeyLocation === 'query'
  ) {
    params.push({ key: auth.apiKeyKey, value: auth.apiKeyValue });
  }

  if (params.length === 0) return request.url;

  const sep = request.url.includes('?') ? '&' : '?';
  const qs = params
    .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join('&');
  return `${request.url}${sep}${qs}`;
}

// ── Auth lines ────────────────────────────────────────────────────────────────

function authLines(request: ApiRequest): string[] {
  const { auth } = request;

  if (auth.type === 'bearer' && auth.bearerToken) {
    return [`  --header ${sq(`Authorization: Bearer ${auth.bearerToken}`)}`];
  }

  if (auth.type === 'basic') {
    // --user is the idiomatic cURL flag for basic auth.
    return [`  --user ${sq(`${auth.username ?? ''}:${auth.password ?? ''}`)}`];
  }

  if (auth.type === 'apiKey' && auth.apiKeyKey && auth.apiKeyValue) {
    if (auth.apiKeyLocation !== 'query') {
      // 'header' location (default)
      return [`  --header ${sq(`${auth.apiKeyKey}: ${auth.apiKeyValue}`)}`];
    }
    // query location: already embedded in the URL by buildUrl
  }

  return [];
}

// ── Implicit Content-Type ─────────────────────────────────────────────────────

function implicitContentType(request: ApiRequest): string | null {
  switch (request.bodyType) {
    case 'json':                  return 'application/json';
    case 'x-www-form-urlencoded': return 'application/x-www-form-urlencoded';
    default:                      return null;
  }
}

// ── Body lines ────────────────────────────────────────────────────────────────

function bodyLines(request: ApiRequest): string[] {
  switch (request.bodyType) {
    case 'json':
    case 'text':
      if (!request.bodyRaw) return [];
      return [`  --data-raw ${sq(request.bodyRaw)}`];

    case 'x-www-form-urlencoded': {
      const enabled = request.bodyFormFields.filter(f => f.enabled && f.key);
      if (enabled.length === 0) return [];
      // Encode each field: --data-urlencode encodes the value (after '=') only;
      // encode the key manually for correctness.
      return enabled.map(f =>
        `  --data-urlencode ${sq(`${encodeURIComponent(f.key)}=${f.value}`)}`,
      );
    }

    case 'form-data': {
      const textFields = request.bodyFormFields.filter(
        f => f.enabled && f.key && f.type === 'text',
      );
      const fileFields = request.bodyFormFields.filter(
        f => f.enabled && f.type === 'file',
      );
      const lines: string[] = textFields.map(f => `  --form ${sq(`${f.key}=${f.value}`)}`);
      if (fileFields.length > 0) {
        const names = fileFields.map(f => f.key || '(unnamed)').join(', ');
        lines.push(`  # file fields omitted (${names}) — attach manually`);
      }
      return lines;
    }

    default:
      return [];
  }
}

// ── Shell quoting ─────────────────────────────────────────────────────────────

/**
 * Wrap a string in single quotes, escaping any embedded single quotes
 * using the standard shell idiom: ' → '\''
 */
function sq(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}
