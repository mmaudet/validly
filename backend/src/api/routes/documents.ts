import type { FastifyInstance } from 'fastify';
import { createDocumentService, DocumentError } from '../../services/document-service.js';
import { LocalStorageAdapter } from '../../infrastructure/storage/local-adapter.js';
import { env } from '../../config/env.js';
import type { JwtPayload } from '../../services/auth-service.js';

const storage = new LocalStorageAdapter(env.STORAGE_PATH);
const documentService = createDocumentService(storage);

export async function documentRoutes(app: FastifyInstance) {
  const authenticate = async (req: any) => { await req.jwtVerify(); };

  app.post('/documents', {
    schema: {
      tags: ['Documents'],
      summary: 'Upload a document',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            tags: { type: 'array', items: { type: 'string' } },
            fileName: { type: 'string' },
            fileSize: { type: 'number' },
            mimeType: { type: 'string' },
            createdAt: { type: 'string' },
          },
        },
      },
    },
    preHandler: [authenticate],
  }, async (req, reply) => {
    try {
      const data = await req.file();
      if (!data) {
        return reply.status(400).send({ message: 'No file uploaded' });
      }

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const fileBuffer = Buffer.concat(chunks);

      const fields = data.fields as Record<string, any>;
      const title = fields.title?.value ?? data.filename;
      const description = fields.description?.value;
      const tagsRaw = fields.tags?.value;
      const tags = tagsRaw ? JSON.parse(tagsRaw) : [];

      const user = req.user as JwtPayload;
      const doc = await documentService.upload({
        title,
        description,
        tags,
        fileName: data.filename,
        fileSize: fileBuffer.length,
        mimeType: data.mimetype,
        data: fileBuffer,
        uploaderId: user.sub,
      });

      return reply.status(201).send(doc);
    } catch (err) {
      if (err instanceof DocumentError) {
        return reply.status(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  app.get('/documents', {
    schema: {
      tags: ['Documents'],
      summary: 'List my documents',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            documents: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  tags: { type: 'array', items: { type: 'string' } },
                  fileName: { type: 'string' },
                  fileSize: { type: 'number' },
                  mimeType: { type: 'string' },
                  createdAt: { type: 'string' },
                },
              },
            },
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
    preHandler: [authenticate],
  }, async (req) => {
    const user = req.user as JwtPayload;
    const query = req.query as any;
    return documentService.listByUploader(user.sub, query.page, query.limit);
  });

  app.get('/documents/:id', {
    schema: {
      tags: ['Documents'],
      summary: 'Get document metadata',
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
      return await documentService.getById(id);
    } catch (err) {
      if (err instanceof DocumentError) {
        return reply.status(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });

  app.get('/documents/:id/file', {
    schema: {
      tags: ['Documents'],
      summary: 'Download/preview document file',
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
      const file = await documentService.getFile(id);
      reply.header('Content-Type', file.contentType);
      reply.header('Content-Disposition', `inline; filename="${file.fileName}"`);
      return reply.send(file.data);
    } catch (err) {
      if (err instanceof DocumentError) {
        return reply.status(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });
}
