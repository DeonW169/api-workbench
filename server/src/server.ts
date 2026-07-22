import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRunnerRoutes } from './routes/runner.js';

/**
 * Request bodies carry base64-encoded file uploads, which inflate by ~33%.
 * Fastify's 1 MB default rejected any file over roughly 750 KB with a 413.
 */
const BODY_LIMIT = Number(process.env['BODY_LIMIT'] ?? 50 * 1024 * 1024);

const PORT = Number(process.env['PORT'] ?? 3000);

/**
 * Loopback by default. This service proxies arbitrary outbound requests with no
 * authentication, so binding 0.0.0.0 turns the machine into an open relay for
 * anyone on the network — including to internal hosts the browser could not
 * otherwise reach. Set HOST explicitly to opt in.
 */
const HOST = process.env['HOST'] ?? '127.0.0.1';

const CORS_ORIGINS = (process.env['CORS_ORIGIN'] ?? 'http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

async function bootstrap() {
    const app = Fastify({ logger: true, bodyLimit: BODY_LIMIT });

    await app.register(cors, {
        origin: CORS_ORIGINS,
        credentials: true,
    });

    app.get('/api/health', async () => ({ ok: true }));

    await app.register(registerRunnerRoutes, { prefix: '/api/runner' });

    await app.listen({ port: PORT, host: HOST });

    if (HOST === '0.0.0.0') {
        app.log.warn(
            'Listening on all interfaces. This runner is unauthenticated — anyone ' +
            'who can reach this port can proxy requests through it.',
        );
    }
}

bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
});
