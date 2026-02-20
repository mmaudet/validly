import type { FastifyInstance } from 'fastify';
import { commentService, CommentError } from '../../services/comment-service.js';
import type { JwtPayload } from '../../services/auth-service.js';

export async function commentRoutes(app: FastifyInstance) {
  const authenticate = async (req: any) => { await req.jwtVerify(); };

  /**
   * GET /workflows/:id/comments
   * Returns comments for a workflow in chronological order.
   * Access: workflow initiator or registered validator.
   */
  app.get('/workflows/:id/comments', {
    schema: {
      tags: ['Comments'],
      summary: 'List comments for a workflow',
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
      const comments = await commentService.listComments(id, user.sub);
      return reply.send(comments);
    } catch (err) {
      if (err instanceof CommentError) {
        return reply.status(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  /**
   * POST /workflows/:id/comments
   * Create a new comment on a workflow.
   * Access: workflow initiator or registered validator.
   * Guard: workflow must not be in a terminal state.
   */
  app.post('/workflows/:id/comments', {
    schema: {
      tags: ['Comments'],
      summary: 'Add a comment to a workflow',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        required: ['body'],
        properties: {
          body: { type: 'string', minLength: 1 },
        },
      },
    },
    preHandler: [authenticate],
  }, async (req, reply) => {
    try {
      const { id } = req.params as any;
      const user = req.user as JwtPayload;
      const body = req.body as { body: string };
      const comment = await commentService.addComment(id, user.sub, body.body);
      return reply.status(201).send(comment);
    } catch (err) {
      if (err instanceof CommentError) {
        return reply.status(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });
}
