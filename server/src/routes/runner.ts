import type { FastifyInstance, FastifyPluginOptions } from 'fastify';

type KeyValue = { key: string; value: string; enabled?: boolean };

type FormField = {
    key: string;
    /** Text value for 'text' fields; filename for 'file' fields. */
    value: string;
    enabled?: boolean;
    type: 'text' | 'file';
    /** Base64-encoded file content, present only for 'file' type fields. */
    fileContent?: string;
};

/** Must stay in sync with HttpMethod in web/src/app/shared/models/api-request.model.ts */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/** Methods fetch refuses to send a body with, plus DELETE which this app treats as bodyless. */
const BODYLESS_METHODS: readonly HttpMethod[] = ['GET', 'HEAD', 'DELETE'];

type ExecuteRequestDto = {
    method: HttpMethod;
    url: string;
    queryParams?: KeyValue[];
    headers?: KeyValue[];
    bodyType?: 'none' | 'json' | 'text' | 'form-data' | 'x-www-form-urlencoded';
    bodyRaw?: string;
    bodyFormFields?: FormField[];
};

/** Outbound request timeout. Undici would otherwise stall for its 5-minute default. */
const REQUEST_TIMEOUT_MS = Number(process.env['RUNNER_TIMEOUT_MS'] ?? 30_000);

/**
 * Flatten response headers into a plain record.
 *
 * Set-Cookie is special-cased: a response may carry several, and folding them
 * into one comma-joined string (as Headers.entries does) corrupts cookies whose
 * Expires attribute itself contains a comma.
 */
function collectHeaders(headers: Headers): Record<string, string> {
    const record: Record<string, string> = {};
    for (const [key, value] of headers.entries()) {
        if (key.toLowerCase() === 'set-cookie') continue;
        record[key] = value;
    }
    const cookies = headers.getSetCookie();
    if (cookies.length > 0) record['set-cookie'] = cookies.join('\n');
    return record;
}

/** Matches application/json plus structured-suffix types like application/vnd.api+json. */
function isJsonContentType(contentType: string): boolean {
    return /^application\/([\w.-]+\+)?json\b/i.test(contentType.trim());
}

/** Translate a fetch rejection into a message that names the actual problem. */
function describeFetchError(
    err: unknown,
    url: URL,
    timeoutMs: number,
): { error: string; message: string } {
    if (err instanceof Error && err.name === 'TimeoutError') {
        return {
            error: 'timeout',
            message: `Request to ${url.host} timed out after ${timeoutMs} ms.`,
        };
    }

    // Node surfaces the real reason on `cause` — either directly, or on an
    // AggregateError when several addresses were tried. `err.message` itself is
    // always the useless string "fetch failed".
    const cause = err instanceof Error
        ? (err.cause as { code?: string; message?: string } | undefined)
        : undefined;
    const detail: Record<string, string> = {
        ECONNREFUSED: `Connection refused by ${url.host}. Is the server running?`,
        ENOTFOUND: `Cannot resolve host "${url.hostname}". Check the URL for typos.`,
        ECONNRESET: `Connection to ${url.host} was reset.`,
        EHOSTUNREACH: `Host ${url.host} is unreachable.`,
        ETIMEDOUT: `Connection to ${url.host} timed out.`,
        CERT_HAS_EXPIRED: `The TLS certificate for ${url.host} has expired.`,
        DEPTH_ZERO_SELF_SIGNED_CERT: `${url.host} uses a self-signed TLS certificate.`,
        UNABLE_TO_VERIFY_LEAF_SIGNATURE: `Could not verify the TLS certificate for ${url.host}.`,
    };

    const code = cause?.code;
    const fallback = cause?.message || (err instanceof Error ? err.message : '');
    return {
        error: 'network-error',
        message:
            (code && detail[code]) ??
            (fallback ? `Request to ${url.host} failed: ${fallback}` : 'Request failed.'),
    };
}

export async function registerRunnerRoutes(
    app: FastifyInstance,
    _opts: FastifyPluginOptions,
) {
    app.post('/execute', async (request, reply) => {
        const payload = request.body as ExecuteRequestDto;

        // ── URL + query params ────────────────────────────────────────────────
        // Guarded: an unparseable URL is user error, not a server fault, and
        // must not surface as an opaque 500.
        let url: URL;
        try {
            url = new URL(payload.url);
        } catch {
            return reply.code(400).send({
                error: 'invalid-url',
                message: payload.url
                    ? `"${payload.url}" is not a valid URL. Include a scheme, e.g. https://`
                    : 'No URL provided.',
            });
        }
        for (const param of payload.queryParams ?? []) {
            if (param.enabled === false || !param.key) continue;
            // append, not set: repeated keys (?tag=a&tag=b) are meaningful and
            // `set` silently collapsed them to the last value.
            url.searchParams.append(param.key, param.value ?? '');
        }

        // ── Request headers ───────────────────────────────────────────────────
        const headers = new Headers();
        for (const header of payload.headers ?? []) {
            if (header.enabled === false || !header.key) continue;
            headers.set(header.key, header.value ?? '');
        }

        // ── Body assembly ─────────────────────────────────────────────────────
        const init: RequestInit = { method: payload.method, headers };

        const hasBody =
            !BODYLESS_METHODS.includes(payload.method) &&
            payload.bodyType &&
            payload.bodyType !== 'none';

        if (hasBody) {
            switch (payload.bodyType) {
                case 'json':
                    init.body = payload.bodyRaw ?? '';
                    if (!headers.has('Content-Type')) {
                        headers.set('Content-Type', 'application/json');
                    }
                    break;

                case 'text':
                    init.body = payload.bodyRaw ?? '';
                    if (!headers.has('Content-Type')) {
                        headers.set('Content-Type', 'text/plain');
                    }
                    break;

                case 'x-www-form-urlencoded': {
                    const params = new URLSearchParams();
                    for (const field of payload.bodyFormFields ?? []) {
                        if (field.enabled === false || !field.key) continue;
                        params.append(field.key, field.value ?? '');
                    }
                    init.body = params;
                    if (!headers.has('Content-Type')) {
                        headers.set('Content-Type', 'application/x-www-form-urlencoded');
                    }
                    break;
                }

                case 'form-data': {
                    const formData = new FormData();
                    for (const field of payload.bodyFormFields ?? []) {
                        if (field.enabled === false || !field.key) continue;
                        if (field.type === 'file' && field.fileContent) {
                            // Decode base64 → Buffer → Blob so fetch sets the boundary correctly
                            const buffer = Buffer.from(field.fileContent, 'base64');
                            const blob = new Blob([buffer]);
                            formData.append(field.key, blob, field.value || 'file');
                        } else {
                            formData.append(field.key, field.value ?? '');
                        }
                    }
                    init.body = formData;
                    // Do NOT set Content-Type — fetch adds the multipart boundary automatically
                    break;
                }
            }
        }

        // ── Execute ───────────────────────────────────────────────────────────
        // A network failure is a property of the target, not a bug here, so it
        // is reported as 502 with a readable cause rather than crashing to 500.
        const started = Date.now();
        let response: Response;
        try {
            init.signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
            response = await fetch(url.toString(), init);
        } catch (err) {
            return reply.code(502).send(describeFetchError(err, url, REQUEST_TIMEOUT_MS));
        }
        const durationMs = Date.now() - started;

        const responseHeaders = collectHeaders(response.headers);
        const contentType = response.headers.get('content-type') ?? '';

        // ── Response body ──────────────────────────────────────────────────────
        // Images are returned as a base64 data URL so the frontend can render
        // them directly without any additional fetch.  All other content is read
        // as text; JSON responses are additionally parsed into an object so the
        // frontend can render a collapsible tree.
        let parsedBody: unknown;
        let size: number;

        // The abort signal stays armed while the body streams, so a server that
        // returns headers quickly but trickles the body can abort here too —
        // that must surface as the same 502 envelope, not an unhandled 500.
        try {
            if (contentType.startsWith('image/')) {
                const buffer = await response.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                parsedBody = `data:${contentType};base64,${base64}`;
                size = buffer.byteLength;
            } else {
                const text = await response.text();
                parsedBody = text;
                // Byte length, not character count — they diverge for any non-ASCII body.
                size = Buffer.byteLength(text, 'utf8');
                if (isJsonContentType(contentType)) {
                    try {
                        parsedBody = JSON.parse(text);
                    } catch {
                        parsedBody = text;
                    }
                }
            }
        } catch (err) {
            return reply.code(502).send(describeFetchError(err, url, REQUEST_TIMEOUT_MS));
        }

        return reply.send({
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            durationMs,
            headers: responseHeaders,
            body: parsedBody,
            contentType,
            size,
        });
    });
}
