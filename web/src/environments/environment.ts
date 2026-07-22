/**
 * Production configuration.
 *
 * Replaced at build time by environment.development.ts for dev builds
 * (see the fileReplacements entry in angular.json).
 *
 * NOTE: this project has no packaged deployment story yet — the runner is
 * expected to be a separate local process. If you deploy the frontend behind a
 * reverse proxy that forwards /api to the runner, change this to '/api'.
 */
export const environment = {
  production: true,
  /** Base URL of the Fastify request runner, without a trailing slash. */
  runnerBaseUrl: 'http://localhost:3000/api',
};
