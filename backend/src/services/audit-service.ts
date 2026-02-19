import { prisma } from '../infrastructure/database.js';

export const auditService = {
  async getByWorkflow(workflowId: string) {
    return prisma.auditEvent.findMany({
      where: {
        OR: [
          { entityType: 'workflow', entityId: workflowId },
          {
            entityType: 'step',
            metadata: { path: ['workflowId'], equals: workflowId },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  async exportCsv(workflowId: string): Promise<string> {
    const events = await prisma.auditEvent.findMany({
      where: {
        OR: [
          { entityType: 'workflow', entityId: workflowId },
          {
            entityType: 'step',
            metadata: { path: ['workflowId'], equals: workflowId },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    // Also include actions directly
    const actions = await prisma.workflowAction.findMany({
      where: { workflowId },
      orderBy: { createdAt: 'asc' },
      include: {
        step: { select: { name: true } },
      },
    });

    const header = 'timestamp,action,actor_email,step,comment';
    const auditRows = events.map(e =>
      `${e.createdAt.toISOString()},${csvEscape(e.action)},${csvEscape(e.actorEmail)},${csvEscape(e.entityType + ':' + e.entityId)},`
    );
    const actionRows = actions.map(a =>
      `${a.createdAt.toISOString()},${csvEscape(a.action)},${csvEscape(a.actorEmail)},${csvEscape(a.step.name)},${csvEscape(a.comment ?? '')}`
    );

    return [header, ...auditRows, ...actionRows].join('\n');
  },
};

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
