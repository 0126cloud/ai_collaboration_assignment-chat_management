import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestDb, setupTestSchema, seedTestData, closeTestDb } from '../helpers/testDb';
import { createTestApp, applyErrorHandlers } from '../helpers/testApp';
import type express from 'express';

let app: express.Express;
let seniorToken: string;

beforeAll(async () => {
  const db = createTestDb();
  await setupTestSchema(db);
  await seedTestData(db);
  app = createTestApp(db);
  applyErrorHandlers(app);

  // 透過 login API 取得 token
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin01', password: '123456' });
  seniorToken = res.body.data.token;
});

afterAll(async () => {
  await closeTestDb();
});

describe('POST /api/auth/logout', () => {
  // @happy_path
  it('登出 → 200 + 清除 cookie（Set-Cookie Expires 為過去時間）', async () => {
    const res = await request(app).post('/api/auth/logout').set('Cookie', `token=${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('登出成功');

    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(cookieStr).toMatch(/token=/);
    expect(cookieStr).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  // @happy_path
  it('登出後再請求 /me（不帶 cookie）→ 401', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  // @security
  it('未認證請求 /logout → 401', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_MISSING_TOKEN');
  });
});
