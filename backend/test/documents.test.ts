import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import FormData from 'form-data';

const shouldRun = !!process.env.DATABASE_URL;

describe.skipIf(!shouldRun)('Document endpoints', () => {
  let app: FastifyInstance;
  let accessToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: {
        email: `doc-test-${Date.now()}@example.com`,
        password: 'testpassword123',
        name: 'Doc Tester',
      },
    });
    accessToken = JSON.parse(signupRes.payload).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/documents uploads a file', async () => {
    const form = new FormData();
    form.append('file', Buffer.from('fake pdf content'), {
      filename: 'test.pdf',
      contentType: 'application/pdf',
    });
    form.append('title', 'Test Document');
    form.append('description', 'A test document');
    form.append('tags', JSON.stringify(['test', 'demo']));

    const res = await app.inject({
      method: 'POST',
      url: '/api/documents',
      headers: {
        authorization: `Bearer ${accessToken}`,
        ...form.getHeaders(),
      },
      payload: form.getBuffer(),
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.title).toBe('Test Document');
    expect(body.fileName).toBe('test.pdf');
    expect(body.mimeType).toBe('application/pdf');
  });

  it('GET /api/documents lists user documents', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/documents',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.documents.length).toBeGreaterThan(0);
    expect(body.total).toBeGreaterThan(0);
  });

  it('GET /api/documents/:id/file serves the file', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/documents',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const docId = JSON.parse(listRes.payload).documents[0].id;

    const res = await app.inject({
      method: 'GET',
      url: `/api/documents/${docId}/file`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
  });
});
