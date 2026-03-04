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

type ExecuteRequestDto = {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    url: string;
    queryParams?: KeyValue[];
    headers?: KeyValue[];
    bodyType?: 'none' | 'json' | 'text' | 'form-data' | 'x-www-form-urlencoded';
    bodyRaw?: string;
    bodyFormFields?: FormField[];
};

export async function registerRunnerRoutes(
    app: FastifyInstance,
    _opts: FastifyPluginOptions,
) {
    app.post('/execute', async (request, reply) => {
        const payload = request.body as ExecuteRequestDto;

        // ── URL + query params ────────────────────────────────────────────────
        const url = new URL(payload.url);
        for (const param of payload.queryParams ?? []) {
            if (param.enabled === false || !param.key) continue;
            url.searchParams.set(param.key, param.value ?? '');
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
            payload.method !== 'GET' &&
            payload.method !== 'DELETE' &&
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
        const started = Date.now();
        const response = await fetch(url.toString(), init);
        const durationMs = Date.now() - started;

        const responseHeaders = Object.fromEntries(response.headers.entries());
        const contentType = response.headers.get('content-type') ?? '';
        const text = await response.text();

        let parsedBody: unknown = text;
        if (contentType.includes('application/json')) {
            try {
                parsedBody = JSON.parse(text);
            } catch {
                parsedBody = text;
            }
        }

        return reply.send({
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            durationMs,
            headers: responseHeaders,
            body: parsedBody,
            contentType,
            size: text.length,
        });
    });
}
