import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

// These tests require a running PostgreSQL database.
// Skip in CI if DATABASE_URL is not set.
const shouldRun = !!process.env.DATABASE_URL;

describe.skipIf(!shouldRun)('Auth endpoints', () => {
  let app: FastifyInstance;
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'testpassword123',
    name: 'Test User',
  };

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/auth/signup creates account and returns tokens', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: testUser,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
  });

  it('POST /api/auth/signup rejects duplicate email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: testUser,
    });

    expect(res.statusCode).toBe(409);
  });

  it('POST /api/auth/login returns tokens for valid credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: testUser.email,
        password: testUser.password,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
  });

  it('POST /api/auth/login rejects invalid password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: testUser.email,
        password: 'wrongpassword',
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it('GET /api/auth/me returns profile with valid token', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: testUser.email,
        password: testUser.password,
      },
    });
    const { accessToken } = JSON.parse(loginRes.payload);

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.email).toBe(testUser.email);
    expect(body.name).toBe(testUser.name);
  });

  it('POST /api/auth/refresh rotates tokens', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: testUser.email,
        password: testUser.password,
      },
    });
    const { refreshToken } = JSON.parse(loginRes.payload);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.refreshToken).not.toBe(refreshToken);
  });
});
