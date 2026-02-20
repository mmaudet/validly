import type { FastifyInstance } from 'fastify';
import { notificationService, NotificationError } from '../../services/notification-service.js';
import type { JwtPayload } from '../../services/auth-service.js';

export async function notificationRoutes(app: FastifyInstance) {
  const authenticate = async (req: any) => { await req.jwtVerify(); };

  /**
   * GET /notifications
   * Returns the authenticated user's notifications, optionally filtered by unread.
   * Response: { notifications: [...], unreadCount: N }
   */
  app.get('/notifications', {
    schema: {
      tags: ['Notifications'],
      summary: 'List notifications for the current user',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          unread: { type: 'boolean' },
          limit: { type: 'number', default: 50 },
        },
      },
    },
    preHandler: [authenticate],
  }, async (req, reply) => {
    const user = req.user as JwtPayload;
    const query = req.query as { unread?: boolean; limit?: number };
    const [notifications, unreadCount] = await Promise.all([
      notificationService.listForUser(user.sub, { unread: query.unread, limit: query.limit }),
      notificationService.getUnreadCount(user.sub),
    ]);
    return reply.send({ notifications, unreadCount });
  });

  /**
   * PATCH /notifications/read-all
   * Mark all unread notifications as read for the current user.
   * IMPORTANT: This route MUST be registered BEFORE /notifications/:id/read
   * to prevent Fastify from matching "read-all" as an :id parameter.
   */
  app.patch('/notifications/read-all', {
    schema: {
      tags: ['Notifications'],
      summary: 'Mark all notifications as read',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate],
  }, async (req, reply) => {
    const user = req.user as JwtPayload;
    await notificationService.markAllRead(user.sub);
    return reply.status(200).send({ message: 'All notifications marked as read' });
  });

  /**
   * PATCH /notifications/:id/read
   * Mark a single notification as read.
   */
  app.patch('/notifications/:id/read', {
    schema: {
      tags: ['Notifications'],
      summary: 'Mark a notification as read',
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
      const user = req.user as JwtPayload;
      await notificationService.markRead(id, user.sub);
      return reply.status(200).send({ message: 'Notification marked as read' });
    } catch (err) {
      if (err instanceof NotificationError) {
        return reply.status(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  /**
   * GET /users/me/notification-prefs
   * Returns the user's notification preference map.
   * Default: all types enabled if no preferences set.
   */
  app.get('/users/me/notification-prefs', {
    schema: {
      tags: ['Notifications'],
      summary: 'Get notification preferences',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate],
  }, async (req, reply) => {
    const user = req.user as JwtPayload;
    const prefs = await notificationService.getPreferences(user.sub);
    return reply.send(prefs);
  });

  /**
   * PUT /users/me/notification-prefs
   * Save per-type enable/disable preferences.
   * Body: Record<string, boolean> — unknown keys are ignored.
   */
  app.put('/users/me/notification-prefs', {
    schema: {
      tags: ['Notifications'],
      summary: 'Update notification preferences',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        additionalProperties: { type: 'boolean' },
      },
    },
    preHandler: [authenticate],
  }, async (req, reply) => {
    try {
      const user = req.user as JwtPayload;
      const body = req.body as Record<string, boolean>;
      const prefs = await notificationService.updatePreferences(user.sub, body);
      return reply.send(prefs);
    } catch (err) {
      if (err instanceof NotificationError) {
        return reply.status(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });
}
