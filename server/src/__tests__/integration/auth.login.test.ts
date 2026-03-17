import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestDb, setupTestSchema, seedTestData, closeTestDb } from '../helpers/testDb';
import { createTestApp, applyErrorHandlers } from '../helpers/testApp';
import type express from 'express';

let app: express.Express;

beforeAll(async () => {
  const db = createTestDb();
  await setupTestSchema(db);
  await seedTestData(db);
  app = createTestApp(db);
  applyErrorHandlers(app);
});

afterAll(async () => {
  await closeTestDb();
});

describe('POST /api/auth/login', () => {
  // @happy_path
  it('正確帳密 → 200 + token + user info', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin01', password: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user).toEqual({
      id: expect.any(Number),
      username: 'admin01',
      role: 'senior_manager',
    });
  });

  // @validation
  it('缺少 username → 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // @validation
  it('缺少 password → 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'admin01' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // @error_handling
  it('帳號不存在 → 401 AUTH_INVALID_CREDENTIALS', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nonexistent', password: '123456' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  // @error_handling
  it('密碼錯誤 → 401 AUTH_INVALID_CREDENTIALS', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin01', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  // @permissions
  it('帳號停用 → 403 AUTH_ACCOUNT_DISABLED', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin03', password: '123456' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_ACCOUNT_DISABLED');
  });

  // envelope 格式驗證
  it('回應格式符合 envelope 結構', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin01', password: '123456' });

    expect(res.body).toHaveProperty('success');
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data).toHaveProperty('user');
  });

  // @happy_path HttpOnly Cookie
  it('登入成功 → response header 包含 Set-Cookie，cookie 屬性含 HttpOnly', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin01', password: '123456' });

    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(cookieStr).toMatch(/token=/);
    expect(cookieStr).toMatch(/HttpOnly/i);
  });

  // @happy_path 向後相容
  it('登入成功 → response body 仍包含 token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin01', password: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(typeof res.body.data.token).toBe('string');
  });
});
