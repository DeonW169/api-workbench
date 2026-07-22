/** Development configuration: the runner runs as a separate local process. */
export const environment = {
  production: false,
  /** Base URL of the Fastify request runner, without a trailing slash. */
  runnerBaseUrl: 'http://localhost:3000/api',
};
