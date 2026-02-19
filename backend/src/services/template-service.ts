import { prisma } from '../infrastructure/database.js';
import type { WorkflowStructure } from '../domain/workflow-types.js';
import { t } from '../i18n/index.js';

export class TemplateError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'TemplateError';
  }
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  structure: WorkflowStructure;
  createdById: string;
  isShared?: boolean;
}

export const templateService = {
  async create(input: CreateTemplateInput) {
    const template = await prisma.workflowTemplate.create({
      data: {
        name: input.name,
        description: input.description,
        structure: input.structure as any,
        createdById: input.createdById,
        isShared: input.isShared ?? false,
      },
    });

    const user = await prisma.user.findUnique({ where: { id: input.createdById } });
    await prisma.auditEvent.create({
      data: {
        action: 'TEMPLATE_CREATED',
        entityType: 'template',
        entityId: template.id,
        actorId: input.createdById,
        actorEmail: user?.email ?? '',
      },
    });

    return template;
  },

  async getById(id: string) {
    const template = await prisma.workflowTemplate.findUnique({ where: { id } });
    if (!template) throw new TemplateError(404, 'Template not found');
    return template;
  },

  async list(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [templates, total] = await Promise.all([
      prisma.workflowTemplate.findMany({
        where: {
          OR: [
            { createdById: userId },
            { isShared: true },
          ],
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.workflowTemplate.count({
        where: {
          OR: [
            { createdById: userId },
            { isShared: true },
          ],
        },
      }),
    ]);
    return { templates, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async update(id: string, userId: string, data: Partial<CreateTemplateInput>) {
    const template = await prisma.workflowTemplate.findUnique({ where: { id } });
    if (!template) throw new TemplateError(404, 'Template not found');
    if (template.createdById !== userId) throw new TemplateError(403, 'Not authorized');

    return prisma.workflowTemplate.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        structure: data.structure as any,
        isShared: data.isShared,
      },
    });
  },

  async delete(id: string, userId: string) {
    const template = await prisma.workflowTemplate.findUnique({ where: { id } });
    if (!template) throw new TemplateError(404, 'Template not found');
    if (template.createdById !== userId) throw new TemplateError(403, 'Not authorized');

    await prisma.workflowTemplate.delete({ where: { id } });
  },
};
