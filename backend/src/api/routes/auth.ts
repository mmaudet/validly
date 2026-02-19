import type { FastifyInstance } from 'fastify';
import { authService, AuthError } from '../../services/auth-service.js';
import type { JwtPayload } from '../../services/auth-service.js';
import { passwordResetService } from '../../services/password-reset-service.js';

const signupSchema = {
  tags: ['Auth'],
  summary: 'Create a new account',
  body: {
    type: 'object',
    required: ['email', 'password', 'name'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8 },
      name: { type: 'string', minLength: 1 },
      locale: { type: 'string', enum: ['en', 'fr'] },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
      },
    },
  },
};

const loginSchema = {
  tags: ['Auth'],
  summary: 'Log in with email and password',
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
      },
    },
  },
};

const refreshSchema = {
  tags: ['Auth'],
  summary: 'Refresh access token',
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: {
      refreshToken: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
      },
    },
  },
};

const profileSchema = {
  tags: ['Auth'],
  summary: 'Get current user profile',
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        name: { type: 'string' },
        role: { type: 'string' },
        locale: { type: 'string' },
        createdAt: { type: 'string' },
      },
    },
  },
};

export async function authRoutes(app: FastifyInstance) {
  const signJwt = (payload: JwtPayload) => app.jwt.sign(payload);

  app.post('/auth/signup', { schema: signupSchema }, async (req, reply) => {
    try {
      const tokens = await authService.signup(req.body as any, signJwt);
      return reply.status(201).send(tokens);
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.status(err.statusCode as any).send({ message: err.message });
      }
      throw err;
    }
  });

  app.post('/auth/login', { schema: loginSchema }, async (req, reply) => {
    try {
      const tokens = await authService.login(req.body as any, signJwt);
      return reply.send(tokens);
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.status(err.statusCode as any).send({ message: err.message });
      }
      throw err;
    }
  });

  app.post('/auth/refresh', { schema: refreshSchema }, async (req, reply) => {
    try {
      const { refreshToken } = req.body as any;
      const tokens = await authService.refresh(refreshToken, signJwt);
      return reply.send(tokens);
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.status(err.statusCode as any).send({ message: err.message });
      }
      throw err;
    }
  });

  app.post('/auth/logout', {
    schema: {
      tags: ['Auth'],
      summary: 'Log out (invalidate refresh token)',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [async (req) => { await req.jwtVerify(); }],
  }, async (req, reply) => {
    const { refreshToken } = (req.body as any) ?? {};
    const user = req.user as JwtPayload;
    await authService.logout(user.sub, refreshToken);
    return reply.status(204).send();
  });

  app.get('/auth/me', {
    schema: profileSchema,
    preHandler: [async (req) => { await req.jwtVerify(); }],
  }, async (req) => {
    const user = req.user as JwtPayload;
    return authService.getProfile(user.sub);
  });

  app.patch('/auth/profile', {
    schema: {
      tags: ['Auth'],
      summary: 'Update current user profile',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          locale: { type: 'string', enum: ['en', 'fr'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
            role: { type: 'string' },
            locale: { type: 'string' },
            createdAt: { type: 'string' },
          },
        },
      },
    },
    preHandler: [async (req) => { await req.jwtVerify(); }],
  }, async (req, reply) => {
    try {
      const user = req.user as JwtPayload;
      const updated = await authService.updateProfile(user.sub, req.body as any);
      return reply.send(updated);
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.status(err.statusCode as any).send({ message: err.message });
      }
      throw err;
    }
  });

  app.post('/auth/change-password', {
    schema: {
      tags: ['Auth'],
      summary: 'Change current user password',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string', minLength: 8 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    },
    preHandler: [async (req) => { await req.jwtVerify(); }],
  }, async (req, reply) => {
    try {
      const user = req.user as JwtPayload;
      const { currentPassword, newPassword } = req.body as any;
      await authService.changePassword(user.sub, currentPassword, newPassword);
      return reply.send({ message: 'Password changed successfully.' });
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.status(err.statusCode as any).send({ message: err.message });
      }
      throw err;
    }
  });
}
