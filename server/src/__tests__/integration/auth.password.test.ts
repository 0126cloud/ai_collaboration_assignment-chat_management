import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestDb, setupTestSchema, seedTestData, closeTestDb } from '../helpers/testDb';
import { createTestApp, applyErrorHandlers } from '../helpers/testApp';
import { generateToken } from '../helpers/testAuth';
import type express from 'express';

let app: express.Express;
let seniorToken: string;

beforeAll(async () => {
  const db = createTestDb();
  await setupTestSchema(db);
  await seedTestData(db);
  app = createTestApp(db);
  applyErrorHandlers(app);

  // 透過 login 取得真實 token
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin02', password: '123456' });
  seniorToken = res.body.data.token;
});

afterAll(async () => {
  await closeTestDb();
});

describe('PUT /api/auth/password', () => {
  // @happy_path
  it('正確舊密碼 + 新密碼 → 200 成功', async () => {
    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ oldPassword: '123456', newPassword: '654321' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('密碼更新成功');
  });

  // @happy_path — 更新後使用新密碼可登入
  it('更新後使用新密碼可登入', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin02', password: '654321' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // 還原密碼
    const newToken = res.body.data.token;
    await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${newToken}`)
      .send({ oldPassword: '654321', newPassword: '123456' });
  });

  // @error_handling
  it('舊密碼錯誤 → 400 AUTH_OLD_PASSWORD_INCORRECT', async () => {
    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ oldPassword: 'wrongold', newPassword: '654321' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_OLD_PASSWORD_INCORRECT');
  });

  // @validation
  it('新密碼太短 → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ oldPassword: '123456', newPassword: '123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // @validation
  it('缺少欄位 → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ oldPassword: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // @security
  it('未帶 token → 401', async () => {
    const res = await request(app)
      .put('/api/auth/password')
      .send({ oldPassword: '123456', newPassword: '654321' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_MISSING_TOKEN');
  });
});
