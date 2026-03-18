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

describe('PUT /api/admins/:id/toggle', () => {
  // @happy_path
  it('停用 active 帳號 → 200', async () => {
    // admin02 (id=2) is active
    const res = await request(app)
      .put('/api/admins/2/toggle')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.is_active).toBe(0); // SQLite boolean
  });

  // @happy_path
  it('啟用 inactive 帳號 → 200', async () => {
    // admin03 (id=3) is inactive
    const res = await request(app)
      .put('/api/admins/3/toggle')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.is_active).toBe(1); // SQLite boolean
  });

  // @permissions
  it('嘗試 toggle 自己 → 403 ADMIN_CANNOT_SELF_MODIFY', async () => {
    // admin01 (id=1) tries to toggle themselves
    const res = await request(app)
      .put('/api/admins/1/toggle')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ADMIN_CANNOT_SELF_MODIFY');
  });

  // @error_handling
  it('不存在的 id → 404 ADMIN_NOT_FOUND', async () => {
    const res = await request(app)
      .put('/api/admins/9999/toggle')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ADMIN_NOT_FOUND');
  });

  // @permissions
  it('general_manager → 403', async () => {
    const res = await request(app)
      .put('/api/admins/3/toggle')
      .set('Authorization', `Bearer ${generalToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_INSUFFICIENT_PERMISSIONS');
  });

  // @security
  it('未帶 token → 401', async () => {
    const res = await request(app).put('/api/admins/3/toggle');

    expect(res.status).toBe(401);
  });

  // @integration
  it('toggle 後 operation_logs 有 TOGGLE_ADMIN 紀錄', async () => {
    const logs = await db('operation_logs').where({ operation_type: 'TOGGLE_ADMIN' });
    expect(logs.length).toBeGreaterThan(0);
  });
});
