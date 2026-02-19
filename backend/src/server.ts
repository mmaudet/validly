import { buildApp } from './app.js';
import { env } from './config/env.js';

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Swagger UI available at ${env.API_URL}/api/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
