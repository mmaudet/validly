import type { FastifyInstance } from 'fastify';
import { templateService, TemplateError } from '../../services/template-service.js';
import type { JwtPayload } from '../../services/auth-service.js';

export async function templateRoutes(app: FastifyInstance) {
  const authenticate = async (req: any) => { await req.jwtVerify(); };

  app.post('/templates', {
    schema: {
      tags: ['Templates'],
      summary: 'Create a workflow template',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'structure'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          isShared: { type: 'boolean' },
          structure: { type: 'object' },
        },
      },
    },
    preHandler: [authenticate],
  }, async (req, reply) => {
    try {
      const user = req.user as JwtPayload;
      const body = req.body as any;
      const template = await templateService.create({
        name: body.name,
        description: body.description,
        structure: body.structure,
        createdById: user.sub,
        isShared: body.isShared,
      });
      return reply.status(201).send(template);
    } catch (err) {
      if (err instanceof TemplateError) {
        return reply.status(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  app.get('/templates', {
    schema: {
      tags: ['Templates'],
      summary: 'List available templates (own + shared)',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20 },
        },
      },
    },
    preHandler: [authenticate],
  }, async (req) => {
    const user = req.user as JwtPayload;
    const query = req.query as any;
    return templateService.list(user.sub, query.page, query.limit);
  });

  app.get('/templates/:id', {
    schema: {
      tags: ['Templates'],
      summary: 'Get template details',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    preHandler: [authenticate],
  }, async (req, reply) => {
    try {
      const { id } = req.params as any;
      return await templateService.getById(id);
    } catch (err) {
      if (err instanceof TemplateError) {
        return reply.status(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  app.put('/templates/:id', {
    schema: {
      tags: ['Templates'],
      summary: 'Update a template',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          isShared: { type: 'boolean' },
          structure: { type: 'object' },
        },
      },
    },
    preHandler: [authenticate],
  }, async (req, reply) => {
    try {
      const user = req.user as JwtPayload;
      const { id } = req.params as any;
      const body = req.body as any;
      return await templateService.update(id, user.sub, body);
    } catch (err) {
      if (err instanceof TemplateError) {
        return reply.status(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  app.delete('/templates/:id', {
    schema: {
      tags: ['Templates'],
      summary: 'Delete a template',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    preHandler: [authenticate],
  }, async (req, reply) => {
    try {
      const user = req.user as JwtPayload;
      const { id } = req.params as any;
      await templateService.delete(id, user.sub);
      return reply.status(204).send();
    } catch (err) {
      if (err instanceof TemplateError) {
        return reply.status(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });
}
