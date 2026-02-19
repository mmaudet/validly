import type { FastifyInstance } from 'fastify';
import { auditService } from '../../services/audit-service.js';

export async function auditRoutes(app: FastifyInstance) {
  const authenticate = async (req: any) => { await req.jwtVerify(); };

  app.get('/workflows/:id/audit', {
    schema: {
      tags: ['Audit'],
      summary: 'Get audit trail for a workflow',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    preHandler: [authenticate],
  }, async (req) => {
    const { id } = req.params as any;
    return auditService.getByWorkflow(id);
  });

  app.get('/workflows/:id/audit/csv', {
    schema: {
      tags: ['Audit'],
      summary: 'Export audit trail as CSV',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    preHandler: [authenticate],
  }, async (req, reply) => {
    const { id } = req.params as any;
    const csv = await auditService.exportCsv(id);
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="audit-${id}.csv"`);
    return reply.send(csv);
  });
}
