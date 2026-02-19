import type { FastifyInstance } from 'fastify';
import { UserRole } from '@prisma/client';
import { userService, UserError } from '../../services/user-service.js';
import type { JwtPayload } from '../../services/auth-service.js';

export async function userRoutes(app: FastifyInstance) {
  const authenticate = async (req: any) => { await req.jwtVerify(); };

  const requireAdmin = async (req: any, reply: any) => {
    await req.jwtVerify();
    const user = req.user as JwtPayload;
    if (user.role !== 'ADMIN') {
      return reply.status(403).send({ message: 'Admin access required' });
    }
  };

  /**
   * GET /users — List all users.
   * Accessible to all authenticated users (needed for validator picker).
   */
  app.get('/users', {
    schema: {
      tags: ['Users'],
      summary: 'List all users (for validator picker)',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
              role: { type: 'string' },
              locale: { type: 'string' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    },
    preHandler: [authenticate],
  }, async (_req, _reply) => {
    return userService.listAll();
  });

  /**
   * POST /users — Create a new user (admin only).
   */
  app.post('/users', {
    schema: {
      tags: ['Users'],
      summary: 'Create a new user (admin only)',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['email', 'name', 'password', 'role'],
        properties: {
          email: { type: 'string', format: 'email' },
          name: { type: 'string', minLength: 2 },
          password: { type: 'string', minLength: 6 },
          role: { type: 'string', enum: ['ADMIN', 'INITIATEUR', 'VALIDATEUR'] },
          locale: { type: 'string', enum: ['fr', 'en'] },
        },
      },
    },
    preHandler: [requireAdmin],
  }, async (req, reply) => {
    try {
      const body = req.body as {
        email: string;
        name: string;
        password: string;
        role: UserRole;
        locale?: string;
      };
      const user = await userService.create(body);
      return reply.status(201).send(user);
    } catch (err) {
      if (err instanceof UserError) {
        return reply.status(err.statusCode as any).send({ message: err.message });
      }
      throw err;
    }
  });

  /**
   * PATCH /users/:id — Update a user's name, role, or locale (admin only).
   */
  app.patch('/users/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Update a user (admin only)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 2 },
          role: { type: 'string', enum: ['ADMIN', 'INITIATEUR', 'VALIDATEUR'] },
          locale: { type: 'string', enum: ['fr', 'en'] },
        },
      },
    },
    preHandler: [requireAdmin],
  }, async (req, reply) => {
    try {
      const { id } = req.params as any;
      const body = req.body as { name?: string; role?: UserRole; locale?: string };

      // Validate at least one field provided
      if (!body.name && !body.role && !body.locale) {
        return reply.status(400).send({ message: 'At least one field (name, role, locale) must be provided' });
      }

      const user = await userService.update(id, body);
      return reply.status(200).send(user);
    } catch (err) {
      if (err instanceof UserError) {
        return reply.status(err.statusCode as any).send({ message: err.message });
      }
      throw err;
    }
  });

  /**
   * DELETE /users/:id — Delete a user (admin only).
   * Last admin deletion is blocked.
   */
  app.delete('/users/:id', {
    schema: {
      tags: ['Users'],
      summary: 'Delete a user (admin only)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    preHandler: [requireAdmin],
  }, async (req, reply) => {
    try {
      const { id } = req.params as any;
      await userService.delete(id);
      return reply.status(204).send();
    } catch (err) {
      if (err instanceof UserError) {
        return reply.status(err.statusCode as any).send({ message: err.message });
      }
      throw err;
    }
  });
}
