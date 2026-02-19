import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { prisma } from '../infrastructure/database.js';
import type { StorageAdapter } from '../infrastructure/storage/storage-adapter.js';
import { t } from '../i18n/index.js';

export interface UploadInput {
  title: string;
  description?: string;
  tags?: string[];
  fileName: string;
  fileSize: number;
  mimeType: string;
  data: Buffer;
  uploaderId: string;
}

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function createDocumentService(storage: StorageAdapter) {
  return {
    async upload(input: UploadInput) {
      if (!ALLOWED_MIME_TYPES.includes(input.mimeType)) {
        throw new DocumentError(400, t('documents.invalid_type'));
      }

      if (input.fileSize > MAX_FILE_SIZE) {
        throw new DocumentError(400, 'File too large (max 50MB)');
      }

      const ext = path.extname(input.fileName);
      const storageKey = `documents/${randomUUID()}${ext}`;

      await storage.save(storageKey, input.data, input.mimeType);

      const document = await prisma.document.create({
        data: {
          title: input.title,
          description: input.description,
          tags: input.tags ?? [],
          fileName: input.fileName,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
          storageKey,
          uploaderId: input.uploaderId,
        },
      });

      await prisma.auditEvent.create({
        data: {
          action: 'DOCUMENT_UPLOADED',
          entityType: 'document',
          entityId: document.id,
          actorId: input.uploaderId,
          actorEmail: (await prisma.user.findUnique({ where: { id: input.uploaderId } }))?.email ?? '',
          metadata: { fileName: input.fileName, mimeType: input.mimeType, fileSize: input.fileSize },
        },
      });

      return document;
    },

    async getById(id: string) {
      const doc = await prisma.document.findUnique({ where: { id } });
      if (!doc) throw new DocumentError(404, t('documents.not_found'));
      return doc;
    },

    async getFile(id: string) {
      const doc = await prisma.document.findUnique({ where: { id } });
      if (!doc) throw new DocumentError(404, t('documents.not_found'));
      const file = await storage.get(doc.storageKey);
      return { ...file, contentType: doc.mimeType, fileName: doc.fileName };
    },

    async listByUploader(uploaderId: string, page = 1, limit = 20) {
      const skip = (page - 1) * limit;
      const [documents, total] = await Promise.all([
        prisma.document.findMany({
          where: { uploaderId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.document.count({ where: { uploaderId } }),
      ]);
      return { documents, total, page, limit, totalPages: Math.ceil(total / limit) };
    },

    async delete(id: string, userId: string) {
      const doc = await prisma.document.findUnique({ where: { id } });
      if (!doc) throw new DocumentError(404, t('documents.not_found'));
      if (doc.uploaderId !== userId) throw new DocumentError(403, 'Not authorized');

      await storage.delete(doc.storageKey);
      await prisma.document.delete({ where: { id } });
    },
  };
}

export class DocumentError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'DocumentError';
  }
}
