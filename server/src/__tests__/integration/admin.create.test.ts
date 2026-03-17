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

describe('POST /api/admins', () => {
  // @happy_path
  it('senior_manager 新增帳號 → 201 + 新帳號資訊', async () => {
    const res = await request(app)
      .post('/api/admins')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({
        username: 'admin04',
        password: '123456',
        role: 'general_manager',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      username: 'admin04',
      role: 'general_manager',
      is_active: 1, // SQLite boolean
    });
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.created_at).toBeDefined();
  });

  // @security
  it('回應不包含 password_hash', async () => {
    const res = await request(app)
      .post('/api/admins')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({
        username: 'admin05',
        password: '123456',
        role: 'general_manager',
      });

    expect(res.body.data).not.toHaveProperty('password_hash');
  });

  // @validation
  it('username 長度不足 → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/admins')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ username: 'ab', password: '123456', role: 'general_manager' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // @validation
  it('password 長度不足 → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/admins')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ username: 'admin06', password: '123', role: 'general_manager' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // @validation
  it('role 無效 → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/admins')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ username: 'admin06', password: '123456', role: 'invalid_role' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // @error_handling
  it('username 重複 → 409 ADMIN_USERNAME_DUPLICATE', async () => {
    const res = await request(app)
      .post('/api/admins')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({
        username: 'admin01',
        password: '123456',
        role: 'general_manager',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ADMIN_USERNAME_DUPLICATE');
  });

  // @permissions
  it('general_manager 新增帳號 → 403 FORBIDDEN', async () => {
    const res = await request(app)
      .post('/api/admins')
      .set('Authorization', `Bearer ${generalToken}`)
      .send({
        username: 'admin06',
        password: '123456',
        role: 'general_manager',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_INSUFFICIENT_PERMISSIONS');
  });

  // @happy_path — 新增後使用新帳號可登入
  it('新增後使用新帳號可登入', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin04', password: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe('admin04');
  });

  // operation_logs 驗證
  it('operation_logs 有寫入紀錄', async () => {
    const logs = await db('operation_logs').where({ action: 'admin:create' });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].operator_username).toBe('admin01');
    expect(logs[0].target).toBe('admin04');
  });
});
