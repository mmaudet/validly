import type { FastifyInstance } from 'fastify';
import { workflowService, WorkflowError } from '../../services/workflow-service.js';
import { InvalidTransitionError, AlreadyDecidedError } from '../../domain/state-machine.js';
import type { JwtPayload } from '../../services/auth-service.js';

export async function workflowRoutes(app: FastifyInstance) {
  const authenticate = async (req: any) => { await req.jwtVerify(); };

  app.post('/workflows', {
    schema: {
      tags: ['Workflows'],
      summary: 'Launch a new workflow',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['title', 'structure', 'documentIds'],
        properties: {
          title: { type: 'string' },
          templateId: { type: 'string' },
          documentIds: { type: 'array', items: { type: 'string' } },
          structure: {
            type: 'object',
            properties: {
              phases: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    steps: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          execution: { type: 'string', enum: ['SEQUENTIAL', 'PARALLEL'] },
                          quorumRule: { type: 'string', enum: ['UNANIMITY', 'MAJORITY', 'ANY_OF'] },
                          quorumCount: { type: 'number' },
                          validatorEmails: { type: 'array', items: { type: 'string' } },
                          deadlineHours: { type: 'number' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    preHandler: [authenticate],
  }, async (req, reply) => {
    try {
      const user = req.user as JwtPayload;
      const body = req.body as any;
      const workflow = await workflowService.launch({
        title: body.title,
        structure: body.structure,
        documentIds: body.documentIds,
        initiatorId: user.sub,
        templateId: body.templateId,
      });
      return reply.status(201).send(workflow);
    } catch (err) {
      if (err instanceof WorkflowError) {
        return reply.status(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  app.get('/workflows', {
    schema: {
      tags: ['Workflows'],
      summary: 'List my workflows (initiator view)',
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
    return workflowService.listByInitiator(user.sub, query.page, query.limit);
  });

  app.get('/workflows/pending', {
    schema: {
      tags: ['Workflows'],
      summary: 'List pending actions (validator view)',
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
    return workflowService.listPendingForValidator(user.email, query.page, query.limit);
  });

  app.get('/workflows/:id', {
    schema: {
      tags: ['Workflows'],
      summary: 'Get workflow details',
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
      return await workflowService.getById(id);
    } catch (err) {
      if (err instanceof WorkflowError) {
        return reply.status(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  app.patch('/workflows/:id/cancel', {
    schema: {
      tags: ['Workflows'],
      summary: 'Cancel an in-progress workflow (initiator only)',
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
      await workflowService.cancel(id, user.sub);
      return reply.status(200).send({ message: 'Workflow cancelled' });
    } catch (err) {
      if (err instanceof WorkflowError) {
        return reply.status(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  app.post('/workflows/:id/notify', {
    schema: {
      tags: ['Workflows'],
      summary: 'Re-send notifications to pending validators on the active step',
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
      await workflowService.notifyCurrentStep(id, user.sub);
      return reply.status(200).send({ message: 'Notifications sent' });
    } catch (err) {
      if (err instanceof WorkflowError) {
        return reply.status(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  app.post('/workflows/:workflowId/steps/:stepId/action', {
    schema: {
      tags: ['Workflows'],
      summary: 'Record approval or refusal on a step',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          workflowId: { type: 'string' },
          stepId: { type: 'string' },
        },
        required: ['workflowId', 'stepId'],
      },
      body: {
        type: 'object',
        required: ['action', 'comment'],
        properties: {
          action: { type: 'string', enum: ['APPROVE', 'REFUSE'] },
          comment: { type: 'string', minLength: 1 },
        },
      },
    },
    preHandler: [authenticate],
  }, async (req, reply) => {
    try {
      const user = req.user as JwtPayload;
      const params = req.params as any;
      const body = req.body as any;

      const result = await workflowService.recordAction({
        stepId: params.stepId,
        actorEmail: user.email,
        actorId: user.sub,
        action: body.action,
        comment: body.comment,
      });

      return reply.send(result);
    } catch (err) {
      if (err instanceof WorkflowError) {
        return reply.status(err.statusCode).send({ message: err.message });
      }
      if (err instanceof InvalidTransitionError || err instanceof AlreadyDecidedError) {
        return reply.status(409).send({ message: err.message });
      }
      throw err;
    }
  });
}
