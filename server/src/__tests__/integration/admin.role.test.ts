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

describe('PATCH /api/admins/:id/role', () => {
  // @happy_path
  it('更新角色 → 200 + 回傳新角色', async () => {
    // admin02 (id=2) is general_manager, update to senior_manager
    const res = await request(app)
      .patch('/api/admins/2/role')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ role: 'senior_manager' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('senior_manager');
  });

  // @permissions
  it('嘗試更新自己的角色 → 403 ADMIN_CANNOT_SELF_MODIFY', async () => {
    const res = await request(app)
      .patch('/api/admins/1/role')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ role: 'general_manager' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ADMIN_CANNOT_SELF_MODIFY');
  });

  // @error_handling
  it('不存在的 id → 404 ADMIN_NOT_FOUND', async () => {
    const res = await request(app)
      .patch('/api/admins/9999/role')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ role: 'general_manager' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ADMIN_NOT_FOUND');
  });

  // @validation
  it('無效 role 值 → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .patch('/api/admins/2/role')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ role: 'invalid_role' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // @permissions
  it('general_manager → 403', async () => {
    const res = await request(app)
      .patch('/api/admins/3/role')
      .set('Authorization', `Bearer ${generalToken}`)
      .send({ role: 'senior_manager' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_INSUFFICIENT_PERMISSIONS');
  });

  // @security
  it('未帶 token → 401', async () => {
    const res = await request(app).patch('/api/admins/2/role').send({ role: 'general_manager' });

    expect(res.status).toBe(401);
  });

  // @integration
  it('更新後 operation_logs 有 UPDATE_ADMIN_ROLE 紀錄', async () => {
    const logs = await db('operation_logs').where({ operation_type: 'UPDATE_ADMIN_ROLE' });
    expect(logs.length).toBeGreaterThan(0);
  });
});
