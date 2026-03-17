import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestDb, setupTestSchema, seedTestData, closeTestDb } from '../helpers/testDb';
import { createTestApp, applyErrorHandlers } from '../helpers/testApp';
import { expiredToken } from '../helpers/testAuth';
import type express from 'express';

let app: express.Express;
let seniorToken: string;
let generalToken: string;

beforeAll(async () => {
  const db = createTestDb();
  await setupTestSchema(db);
  await seedTestData(db);
  app = createTestApp(db);
  applyErrorHandlers(app);

  // 透過 login API 取得 tokens
  const seniorRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin01', password: '123456' });
  seniorToken = seniorRes.body.data.token;

  const generalRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin02', password: '123456' });
  generalToken = generalRes.body.data.token;
});

afterAll(async () => {
  await closeTestDb();
});

describe('GET /api/auth/me', () => {
  // @happy_path
  it('帶 cookie 請求 /me → 200 + user + permissions', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', `token=${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toEqual({
      id: expect.any(Number),
      username: 'admin01',
      role: 'senior_manager',
    });
    expect(res.body.data.permissions).toBeDefined();
    expect(Array.isArray(res.body.data.permissions)).toBe(true);
  });

  // @happy_path fallback
  it('帶 Bearer token 請求 /me → 200', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.username).toBe('admin01');
  });

  // @happy_path
  it('senior_manager → 回傳 22 個 permissions', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', `token=${seniorToken}`);

    expect(res.body.data.permissions).toHaveLength(22);
  });

  // @happy_path
  it('general_manager → 回傳 15 個 permissions', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', `token=${generalToken}`);

    expect(res.body.data.permissions).toHaveLength(15);
  });

  // @security
  it('無 cookie 也無 token → 401 AUTH_MISSING_TOKEN', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_MISSING_TOKEN');
  });

  // @security
  it('過期 cookie → 401 AUTH_TOKEN_EXPIRED', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', `token=${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_TOKEN_EXPIRED');
  });
});
