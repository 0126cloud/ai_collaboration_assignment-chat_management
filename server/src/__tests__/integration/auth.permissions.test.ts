import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestDb, setupTestSchema, seedTestData, closeTestDb } from '../helpers/testDb';
import { createTestApp, applyErrorHandlers } from '../helpers/testApp';
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

  // 取得 tokens
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

describe('GET /api/auth/permissions', () => {
  // @happy_path
  it('senior_manager → 21 個權限', async () => {
    const res = await request(app)
      .get('/api/auth/permissions')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('senior_manager');
    expect(res.body.data.permissions).toHaveLength(21);
  });

  // @happy_path
  it('general_manager → 15 個權限', async () => {
    const res = await request(app)
      .get('/api/auth/permissions')
      .set('Authorization', `Bearer ${generalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('general_manager');
    expect(res.body.data.permissions).toHaveLength(15);
  });

  // @security
  it('未帶 token → 401', async () => {
    const res = await request(app).get('/api/auth/permissions');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_MISSING_TOKEN');
  });
});
