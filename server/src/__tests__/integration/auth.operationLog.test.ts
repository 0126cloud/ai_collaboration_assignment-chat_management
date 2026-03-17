import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestDb, setupTestSchema, seedTestData, closeTestDb } from '../helpers/testDb';
import { createTestApp, applyErrorHandlers } from '../helpers/testApp';
import { generateToken } from '../helpers/testAuth';
import type express from 'express';
import { Knex } from 'knex';

let app: express.Express;
let db: Knex;

beforeAll(async () => {
  db = createTestDb();
  await setupTestSchema(db);
  await seedTestData(db);
  app = createTestApp(db);
  applyErrorHandlers(app);
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await db('operation_logs').del();
});

// 等待 res.on('finish') 非同步寫入完成
const waitForLog = () => new Promise((resolve) => setTimeout(resolve, 100));

describe('LOGIN 操作紀錄', () => {
  // @integration — 登入後自動產生操作紀錄
  it('登入成功 → operation_logs 有 LOGIN 紀錄，operator 為登入者', async () => {
    await request(app).post('/api/auth/login').send({ username: 'admin01', password: '123456' });

    await waitForLog();

    const logs = await db('operation_logs').where({ operation_type: 'LOGIN' });
    expect(logs).toHaveLength(1);
    expect(logs[0].operator).toBe('admin01');
    expect(logs[0].operator_id).toBe(1);
  });

  // @integration — request.payload 中密碼欄位為 ***
  it('登入成功 → request.payload 中 password 為 ***', async () => {
    await request(app).post('/api/auth/login').send({ username: 'admin01', password: '123456' });

    await waitForLog();

    const logs = await db('operation_logs').where({ operation_type: 'LOGIN' });
    const req = JSON.parse(logs[0].request);
    expect(req.url).toBe('/api/auth/login');
    expect(req.method).toBe('POST');
    expect(req.payload.password).toBe('***');
    expect(req.payload.username).toBe('admin01');
  });

  // @integration — 登入失敗不產生操作紀錄
  it('登入失敗（密碼錯誤）→ 不產生紀錄', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin01', password: 'wrong_password' });

    expect(res.status).toBe(401);
    await waitForLog();

    const logs = await db('operation_logs').where({ operation_type: 'LOGIN' });
    expect(logs).toHaveLength(0);
  });

  // @integration — 帳號不存在也不產生紀錄
  it('登入失敗（帳號不存在）→ 不產生紀錄', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nonexistent', password: '123456' });

    expect(res.status).toBe(401);
    await waitForLog();

    const logs = await db('operation_logs').where({ operation_type: 'LOGIN' });
    expect(logs).toHaveLength(0);
  });
});

describe('LOGOUT 操作紀錄', () => {
  // @integration — 登出後自動產生操作紀錄
  it('登出成功 → operation_logs 有 LOGOUT 紀錄', async () => {
    const token = generateToken({ id: 1, username: 'admin01', role: 'senior_manager' });

    const res = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    await waitForLog();

    const logs = await db('operation_logs').where({ operation_type: 'LOGOUT' });
    expect(logs).toHaveLength(1);
    expect(logs[0].operator).toBe('admin01');
    expect(logs[0].operator_id).toBe(1);
  });

  // @integration — 未登入直接登出不產生操作紀錄
  it('未帶 Token 登出 → 401 + 不產生紀錄', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(401);
    await waitForLog();

    const logs = await db('operation_logs').where({ operation_type: 'LOGOUT' });
    expect(logs).toHaveLength(0);
  });
});
