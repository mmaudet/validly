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
import { workflowRoutes } from './api/routes/workflows.js';
import { actionRoutes } from './api/routes/actions.js';
import { templateRoutes } from './api/routes/templates.js';
import { auditRoutes } from './api/routes/audit.js';
import { userRoutes } from './api/routes/users.js';
import { commentRoutes } from './api/routes/comments.js';
import { notificationRoutes } from './api/routes/notifications.js';

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
  await app.register(workflowRoutes, { prefix: '/api' });
  await app.register(actionRoutes, { prefix: '/api' });
  await app.register(templateRoutes, { prefix: '/api' });
  await app.register(auditRoutes, { prefix: '/api' });
  await app.register(userRoutes, { prefix: '/api' });
  await app.register(commentRoutes, { prefix: '/api' });
  await app.register(notificationRoutes, { prefix: '/api' });

  return app;
}
