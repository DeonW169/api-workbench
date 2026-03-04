import type { FastifyInstance, FastifyPluginOptions } from 'fastify';

type KeyValue = { key: string; value: string; enabled?: boolean };

type ExecuteRequestDto = {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    url: string;
    queryParams?: KeyValue[];
    headers?: KeyValue[];
    bodyType?: 'none' | 'json' | 'text';
    bodyRaw?: string;
};

export async function registerRunnerRoutes(
    app: FastifyInstance,
    _opts: FastifyPluginOptions,
) {
    app.post('/execute', async (request, reply) => {
        const payload = request.body as ExecuteRequestDto;

        const url = new URL(payload.url);

        for (const param of payload.queryParams ?? []) {
            if (param.enabled === false) continue;
            if (!param.key) continue;
            url.searchParams.set(param.key, param.value ?? '');
        }

        const headers = new Headers();
        for (const header of payload.headers ?? []) {
            if (header.enabled === false) continue;
            if (!header.key) continue;
            headers.set(header.key, header.value ?? '');
        }

        const init: RequestInit = {
            method: payload.method,
            headers,
        };

        if (
            payload.method !== 'GET' &&
            payload.method !== 'DELETE' &&
            payload.bodyType &&
            payload.bodyType !== 'none'
        ) {
            init.body = payload.bodyRaw ?? '';

            if (payload.bodyType === 'json' && !headers.has('Content-Type')) {
                headers.set('Content-Type', 'application/json');
            }

            if (payload.bodyType === 'text' && !headers.has('Content-Type')) {
                headers.set('Content-Type', 'text/plain');
            }
        }

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