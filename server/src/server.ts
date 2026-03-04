import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRunnerRoutes } from './routes/runner.js';

async function bootstrap() {
    const app = Fastify({ logger: true });

    await app.register(cors, {
        // origin: ['http://localhost:4200'],
        origin: ['http://localhost:65123'],
        credentials: true,
    });

    app.get('/api/health', async () => ({ ok: true }));

    await app.register(registerRunnerRoutes, { prefix: '/api/runner' });

    await app.listen({ port: 3000, host: '0.0.0.0' });
}

bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
});