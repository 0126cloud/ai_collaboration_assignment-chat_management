import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestDb, setupTestSchema, seedTestData, closeTestDb } from '../helpers/testDb';
import { createTestApp, applyErrorHandlers } from '../helpers/testApp';
import type express from 'express';
import { Knex } from 'knex';

let app: express.Express;
let db: Knex;
let seniorToken: string;
let generalToken: string;

beforeAll(async () => {
  db = createTestDb();
  await setupTestSchema(db);
  await seedTestData(db);
  app = createTestApp(db);
  applyErrorHandlers(app);

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

describe('GET /api/admins', () => {
  // @happy_path
  it('senior_manager 取得列表 → 200', async () => {
    const res = await request(app).get('/api/admins').set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  // @security
  it('回應不包含 password_hash', async () => {
    const res = await request(app).get('/api/admins').set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    res.body.data.forEach((item: Record<string, unknown>) => {
      expect(item).not.toHaveProperty('password_hash');
    });
  });

  // @happy_path
  it('username 模糊搜尋', async () => {
    const res = await request(app)
      .get('/api/admins')
      .query({ username: 'admin01' })
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].username).toBe('admin01');
  });

  // @happy_path
  it('role 篩選', async () => {
    const res = await request(app)
      .get('/api/admins')
      .query({ role: 'senior_manager' })
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    res.body.data.forEach((item: Record<string, unknown>) => {
      expect(item.role).toBe('senior_manager');
    });
  });

  // @permissions
  it('general_manager → 403', async () => {
    const res = await request(app)
      .get('/api/admins')
      .set('Authorization', `Bearer ${generalToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_INSUFFICIENT_PERMISSIONS');
  });

  // @security
  it('未帶 token → 401', async () => {
    const res = await request(app).get('/api/admins');

    expect(res.status).toBe(401);
  });
});
