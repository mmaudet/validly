import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from './config/env.js';
import { initI18n } from './i18n/index.js';
import { healthRoutes } from './api/routes/health.js';
import { authRoutes } from './api/routes/auth.js';
import { documentRoutes } from './api/routes/documents.js';

export async function buildApp() {
  await initI18n();

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z' } }
        : undefined,
    },
  });

  await app.register(cors, { origin: true });

  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Validly API',
        description: 'Document validation workflow platform API',
        version: '0.1.0',
      },
      servers: [{ url: env.API_URL }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/api/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(authRoutes, { prefix: '/api' });
  await app.register(documentRoutes, { prefix: '/api' });

  return app;
}
