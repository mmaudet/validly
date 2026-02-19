import type { FastifyInstance } from 'fastify';
import { tokenService } from '../../services/token-service.js';
import { workflowService, WorkflowError } from '../../services/workflow-service.js';
import { env } from '../../config/env.js';

export async function actionRoutes(app: FastifyInstance) {
  /**
   * Token-based action endpoint.
   * Validators click this link from their email to approve/refuse.
   * No authentication required — the token is the auth.
   */
  app.get('/actions/:token', {
    schema: {
      tags: ['Actions'],
      summary: 'Resolve an email action token (approve/refuse without login)',
      params: {
        type: 'object',
        properties: { token: { type: 'string' } },
        required: ['token'],
      },
    },
  }, async (req, reply) => {
    const { token } = req.params as any;
    const result = await tokenService.resolveToken(token);

    if (!result.valid) {
      // Redirect to frontend error page
      const errorPage = result.reason === 'already_used'
        ? `${env.APP_URL}/action/used`
        : result.reason === 'expired'
          ? `${env.APP_URL}/action/expired`
          : `${env.APP_URL}/action/invalid`;
      return reply.redirect(302, errorPage);
    }

    // Redirect to frontend action page with context
    const actionPage = `${env.APP_URL}/action/confirm?step=${result.stepId}&email=${encodeURIComponent(result.validatorEmail)}&action=${result.action}&token=${token}`;
    return reply.redirect(302, actionPage);
  });

  /**
   * Execute an action from the confirmation page.
   * The frontend POSTs here after the validator adds their comment.
   */
  app.post('/actions/execute', {
    schema: {
      tags: ['Actions'],
      summary: 'Execute an email action with comment',
      body: {
        type: 'object',
        required: ['token', 'comment'],
        properties: {
          token: { type: 'string' },
          comment: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (req, reply) => {
    const { token, comment } = req.body as any;
    const result = await tokenService.resolveToken(token);

    if (!result.valid) {
      const messages: Record<string, string> = {
        not_found: 'Invalid action link',
        already_used: 'This link has already been used',
        expired: 'This link has expired',
      };
      return reply.status(410).send({ message: messages[result.reason] });
    }

    try {
      const actionResult = await workflowService.recordAction({
        stepId: result.stepId!,
        actorEmail: result.validatorEmail!,
        action: result.action!,
        comment,
      });

      return reply.send({
        success: true,
        ...actionResult,
      });
    } catch (err) {
      if (err instanceof WorkflowError) {
        return reply.status(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });
}
