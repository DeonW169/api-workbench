import {
  ApiRequest,
  AuthConfig,
  BodyType,
  FormField,
  HttpMethod,
  KeyValueItem,
} from '../../shared/models/api-request.model';

// ── Public API ────────────────────────────────────────────────────────────────

export interface ParsedCurl {
  url: string;
  method: HttpMethod;
  headers: KeyValueItem[];
  queryParams: KeyValueItem[];
  bodyType: BodyType;
  bodyRaw: string;
  bodyFormFields: FormField[];
  auth: AuthConfig;
}

/**
 * Parse a cURL command string into a ParsedCurl object.
 *
 * Supports:
 *   -X / --request          HTTP method
 *   -H / --header           request headers
 *   -d / --data             raw body (joined with & when repeated)
 *   --data-raw              raw body (not joined)
 *   --data-urlencode        URL-encoded form fields
 *   --form / -F             multipart form fields (text only)
 *   --user / -u             basic auth
 *
 * Authorization header is parsed into the auth model (bearer / basic).
 * The first non-flag token is treated as the URL.
 * If a body is present and no method is explicit, POST is inferred.
 *
 * Returns null if the command does not begin with "curl".
 */
export function parseCurl(command: string): ParsedCurl | null {
  const trimmed = command.trim();
  if (!trimmed) return null;

  const tokens = tokenize(trimmed);
  if (!tokens.length) return null;

  // The first token must be "curl" (possibly with a path prefix like /usr/bin/curl)
  if (!tokens[0].toLowerCase().match(/(^|[\\/])curl$/)) return null;

  // ── First pass: collect flags ──────────────────────────────────────────────

  let url = '';
  let explicitMethod: HttpMethod | null = null;

  const rawHeaders: Array<{ key: string; value: string }> = [];
  const dataParts: string[] = [];       // -d / --data (joined with &)
  let   dataRaw       = '';             // --data-raw (single value, last wins)
  let   hasDataRaw    = false;
  const urlEncFields: Array<{ key: string; value: string }> = [];
  const formFields:   FormField[] = [];

  let authFromUser: AuthConfig | null = null;

  let i = 1;
  while (i < tokens.length) {
    const tok = tokens[i];

    if (tok === '-X' || tok === '--request') {
      const m = (tokens[++i] ?? '').toUpperCase();
      if (isValidMethod(m)) explicitMethod = m;

    } else if (tok === '-H' || tok === '--header') {
      const raw = tokens[++i] ?? '';
      const colon = raw.indexOf(':');
      if (colon !== -1) {
        rawHeaders.push({ key: raw.slice(0, colon).trim(), value: raw.slice(colon + 1).trim() });
      }

    } else if (tok === '-d' || tok === '--data') {
      dataParts.push(tokens[++i] ?? '');

    } else if (tok === '--data-raw') {
      dataRaw = tokens[++i] ?? '';
      hasDataRaw = true;

    } else if (tok === '--data-urlencode') {
      const field = tokens[++i] ?? '';
      // formats: "key=value", "=value" (no key), "value" (bare — treat as body fragment)
      if (!field.startsWith('@') && !field.includes('@')) {
        const eq = field.indexOf('=');
        urlEncFields.push(
          eq !== -1
            ? { key: decodeURIComponent(field.slice(0, eq)), value: field.slice(eq + 1) }
            : { key: '', value: field },
        );
      }

    } else if (tok === '--form' || tok === '-F') {
      const field = tokens[++i] ?? '';
      const eq = field.indexOf('=');
      if (eq !== -1) {
        const val = field.slice(eq + 1);
        // Skip file references (@...)
        if (!val.startsWith('@')) {
          formFields.push({ key: field.slice(0, eq), value: val, enabled: true, type: 'text' });
        }
      }

    } else if (tok === '--user' || tok === '-u') {
      const up = tokens[++i] ?? '';
      const c  = up.indexOf(':');
      authFromUser = {
        type: 'basic',
        username: c !== -1 ? up.slice(0, c) : up,
        password: c !== -1 ? up.slice(c + 1) : '',
      };

    } else if (SKIP_WITH_ARG.has(tok)) {
      i++; // consume argument and ignore

    } else if (!tok.startsWith('-') && !url) {
      url = tok;

    } else if (tok === '--') {
      // End of options; next token is the URL
      if (!url && tokens[i + 1]) url = tokens[++i];

    }
    // All other flags (e.g. -L, -s, -k, --compressed) are silently ignored
    i++;
  }

  if (!url) return null;

  // ── Resolve auth ───────────────────────────────────────────────────────────

  let auth: AuthConfig = authFromUser ?? { type: 'none' };
  const headers: KeyValueItem[] = [];

  for (const h of rawHeaders) {
    if (h.key.toLowerCase() === 'authorization') {
      const bearerMatch = h.value.match(/^bearer\s+(.+)$/i);
      const basicMatch  = h.value.match(/^basic\s+(.+)$/i);

      if (bearerMatch) {
        auth = { type: 'bearer', bearerToken: bearerMatch[1] };
      } else if (basicMatch) {
        try {
          const decoded = atob(basicMatch[1]);
          const c = decoded.indexOf(':');
          auth = {
            type: 'basic',
            username: decoded.slice(0, c > -1 ? c : decoded.length),
            password: c > -1 ? decoded.slice(c + 1) : '',
          };
        } catch {
          // Not valid base64 — keep as plain header
          headers.push({ key: h.key, value: h.value, enabled: true });
        }
      } else {
        headers.push({ key: h.key, value: h.value, enabled: true });
      }
    } else {
      headers.push({ key: h.key, value: h.value, enabled: true });
    }
  }

  // ── Resolve body ───────────────────────────────────────────────────────────

  const hasBody      = dataParts.length > 0 || hasDataRaw;
  const hasForm      = formFields.length > 0;
  const hasUrlEnc    = urlEncFields.length > 0;

  let bodyType: BodyType    = 'none';
  let bodyRaw               = '';
  let bodyFormFields: FormField[] = [];

  if (hasForm) {
    bodyType       = 'form-data';
    bodyFormFields = formFields;

  } else if (hasUrlEnc) {
    bodyType       = 'x-www-form-urlencoded';
    bodyFormFields = urlEncFields.map(f => ({ ...f, enabled: true, type: 'text' as const }));

  } else if (hasBody) {
    const rawBody = hasDataRaw ? dataRaw : dataParts.join('&');

    const ct = headers.find(h => h.key.toLowerCase() === 'content-type')?.value ?? '';

    if (ct.includes('application/x-www-form-urlencoded')) {
      bodyType       = 'x-www-form-urlencoded';
      bodyFormFields = parseUrlEncoded(rawBody);
    } else if (ct.includes('application/json') || isLikelyJson(rawBody)) {
      bodyType = 'json';
      bodyRaw  = rawBody;
    } else {
      bodyType = 'text';
      bodyRaw  = rawBody;
    }
  }

  // ── Method default ─────────────────────────────────────────────────────────

  const method: HttpMethod =
    explicitMethod ?? ((hasBody || hasForm || hasUrlEnc) ? 'POST' : 'GET');

  // ── URL + query params ────────────────────────────────────────────────────

  const { cleanUrl, queryParams } = extractQueryParams(url);

  return { url: cleanUrl, method, headers, queryParams, bodyType, bodyRaw, bodyFormFields, auth };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Flags that consume the next token as an argument but are otherwise ignored. */
const SKIP_WITH_ARG = new Set([
  '-o', '--output',
  '-O', '--remote-name',
  '-w', '--write-out',
  '-A', '--user-agent',
  '-e', '--referer',
  '--max-time', '--connect-timeout', '--max-redirs',
  '-x', '--proxy',
  '--cacert', '--cert', '--key',
  '-K', '--config',
  '--resolve',
]);

function isValidMethod(s: string): s is HttpMethod {
  return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(s);
}

function isLikelyJson(s: string): boolean {
  const t = s.trimStart();
  if (!t.startsWith('{') && !t.startsWith('[')) return false;
  try { JSON.parse(s); return true; } catch { return false; }
}

function parseUrlEncoded(body: string): FormField[] {
  if (!body) return [];
  return body.split('&').map(part => {
    const eq = part.indexOf('=');
    return {
      key:     decodeURIComponent(eq !== -1 ? part.slice(0, eq) : part),
      value:   decodeURIComponent(eq !== -1 ? part.slice(eq + 1) : ''),
      enabled: true,
      type:    'text' as const,
    };
  }).filter(f => f.key);
}

function extractQueryParams(rawUrl: string): {
  cleanUrl: string;
  queryParams: KeyValueItem[];
} {
  try {
    // URL constructor needs a base for relative URLs; provide a dummy one.
    const needsBase = !rawUrl.match(/^https?:\/\//i);
    const parsed = needsBase
      ? new URL(rawUrl, 'http://dummy')
      : new URL(rawUrl);

    const queryParams: KeyValueItem[] = [];
    parsed.searchParams.forEach((value, key) => {
      queryParams.push({ key, value, enabled: true });
    });

    // Reconstruct the clean URL (no query string)
    const clean = needsBase
      ? rawUrl.split('?')[0]
      : `${parsed.protocol}//${parsed.host}${parsed.pathname}`;

    return { cleanUrl: clean, queryParams };
  } catch {
    return { cleanUrl: rawUrl, queryParams: [] };
  }
}

// ── Shell tokenizer ───────────────────────────────────────────────────────────

/**
 * Split a shell command string into tokens, respecting single quotes,
 * double quotes, backslash escapes, and the `'\''` single-quote idiom.
 * Line continuations (`\` + newline) are collapsed to a space first.
 */
function tokenize(input: string): string[] {
  // Collapse line continuations
  const src = input.replace(/\\\n\s*/g, ' ');

  const tokens: string[] = [];
  let i = 0;

  while (i < src.length) {
    // Skip whitespace
    while (i < src.length && /\s/.test(src[i])) i++;
    if (i >= src.length) break;

    let token = '';

    while (i < src.length && !/\s/.test(src[i])) {
      if (src[i] === "'") {
        // Single-quoted segment
        i++; // skip opening '
        while (i < src.length && src[i] !== "'") {
          token += src[i++];
        }
        if (i < src.length) i++; // skip closing '

        // Handle the '\'' escape sequence: immediately followed by \' continues the token
        while (
          i < src.length &&
          src[i] === '\\' &&
          i + 1 < src.length &&
          src[i + 1] === "'"
        ) {
          token += "'";
          i += 2; // skip \'
          // If a new single-quoted segment opens right after, consume it
          if (i < src.length && src[i] === "'") {
            i++; // skip opening '
            while (i < src.length && src[i] !== "'") {
              token += src[i++];
            }
            if (i < src.length) i++; // skip closing '
          }
        }

      } else if (src[i] === '"') {
        // Double-quoted segment
        i++; // skip opening "
        while (i < src.length && src[i] !== '"') {
          if (src[i] === '\\' && i + 1 < src.length) {
            i++;
            token += src[i++];
          } else {
            token += src[i++];
          }
        }
        if (i < src.length) i++; // skip closing "

      } else if (src[i] === '\\') {
        // Backslash escape outside quotes
        i++;
        if (i < src.length) token += src[i++];

      } else {
        token += src[i++];
      }
    }

    if (token) tokens.push(token);
  }

  return tokens;
}

// ── Name suggestion ───────────────────────────────────────────────────────────

/**
 * Suggest a human-readable tab name from a parsed URL + method.
 * E.g. "GET api.example.com/users/123"
 */
export function suggestName(method: string, rawUrl: string): string {
  try {
    const needsBase = !rawUrl.match(/^https?:\/\//i);
    const parsed = needsBase ? new URL(rawUrl, 'http://dummy') : new URL(rawUrl);
    const host = needsBase ? '' : parsed.hostname;
    const path = parsed.pathname.replace(/\/$/, '') || '/';
    return `${method} ${host}${path}`.trim();
  } catch {
    return `${method} ${rawUrl}`;
  }
}
