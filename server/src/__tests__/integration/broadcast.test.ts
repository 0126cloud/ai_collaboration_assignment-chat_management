import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestDb, setupTestSchema, seedTestData, closeTestDb } from '../helpers/testDb';
import { createTestApp, applyErrorHandlers } from '../helpers/testApp';
import { seniorToken, generalToken } from '../helpers/testAuth';
import type express from 'express';
import { Knex } from 'knex';

let app: express.Express;
let db: Knex;

// 用於時間測試的固定時間點
const futureTime = '2099-01-01T00:00:00.000Z';
const pastStart = '2020-01-01T00:00:00.000Z'; // 很久以前開始，早已過期

beforeAll(async () => {
  db = createTestDb();
  await setupTestSchema(db);
  await seedTestData(db);
  app = createTestApp(db);
  applyErrorHandlers(app);

  // 插入測試廣播資料
  await db('broadcasts').insert([
    {
      message: 'Scheduled broadcast',
      chatroom_id: 'all',
      duration: 600,
      start_at: futureTime,
      operator: 'admin01',
    },
    {
      message: 'Expired broadcast',
      chatroom_id: 'baccarat_001',
      duration: 60,
      start_at: pastStart,
      operator: 'admin01',
    },
  ]);
});

afterAll(async () => {
  await closeTestDb();
});

describe('GET /api/broadcasts', () => {
  // @happy_path
  it('回傳廣播列表，每筆含 status → 200', async () => {
    const res = await request(app)
      .get('/api/broadcasts')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.data.every((item: { status: string }) => !!item.status)).toBe(true);
  });

  // @happy_path — status 計算正確
  it('scheduled 廣播 status 應為 scheduled', async () => {
    const res = await request(app)
      .get('/api/broadcasts')
      .set('Authorization', `Bearer ${seniorToken}`);

    const scheduled = res.body.data.find(
      (item: { message: string }) => item.message === 'Scheduled broadcast',
    );
    expect(scheduled).toBeDefined();
    expect(scheduled.status).toBe('scheduled');
  });

  // @happy_path — status 計算正確
  it('expired 廣播 status 應為 expired', async () => {
    const res = await request(app)
      .get('/api/broadcasts')
      .set('Authorization', `Bearer ${seniorToken}`);

    const expired = res.body.data.find(
      (item: { message: string }) => item.message === 'Expired broadcast',
    );
    expect(expired).toBeDefined();
    expect(expired.status).toBe('expired');
  });

  // @happy_path — status 篩選
  it('status=scheduled → 只回傳 scheduled 廣播', async () => {
    const res = await request(app)
      .get('/api/broadcasts?status=scheduled')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((item: { status: string }) => item.status === 'scheduled')).toBe(
      true,
    );
  });

  // @happy_path — status 篩選
  it('status=expired → 只回傳 expired 廣播', async () => {
    const res = await request(app)
      .get('/api/broadcasts?status=expired')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((item: { status: string }) => item.status === 'expired')).toBe(true);
  });

  // @permissions
  it('general_manager → 403', async () => {
    const res = await request(app)
      .get('/api/broadcasts')
      .set('Authorization', `Bearer ${generalToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_INSUFFICIENT_PERMISSIONS');
  });

  // @permissions
  it('未帶 token → 401', async () => {
    const res = await request(app).get('/api/broadcasts');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/broadcasts', () => {
  // @happy_path
  it('發送廣播成功 → 201，回傳含 status 資料', async () => {
    const res = await request(app)
      .post('/api/broadcasts')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({
        message: 'New broadcast message',
        chatroom_id: 'all',
        duration: 300,
        start_at: futureTime,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.message).toBe('New broadcast message');
    expect(res.body.data.status).toBe('scheduled');
    expect(res.body.data.operator).toBe('admin01');
  });

  // @validation — 缺少 message
  it('缺少 message → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/broadcasts')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({
        chatroom_id: 'all',
        duration: 300,
        start_at: futureTime,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // @validation — duration = 0
  it('duration = 0 → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/broadcasts')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({
        message: 'Test',
        chatroom_id: 'all',
        duration: 0,
        start_at: futureTime,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // @validation — 時間格式錯誤
  it('start_at 格式錯誤 → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/broadcasts')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({
        message: 'Test',
        chatroom_id: 'all',
        duration: 60,
        start_at: 'not-a-date',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // @permissions
  it('general_manager → 403', async () => {
    const res = await request(app)
      .post('/api/broadcasts')
      .set('Authorization', `Bearer ${generalToken}`)
      .send({
        message: 'Test',
        chatroom_id: 'all',
        duration: 60,
        start_at: futureTime,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_INSUFFICIENT_PERMISSIONS');
  });
});

describe('DELETE /api/broadcasts/:id', () => {
  // @happy_path
  it('下架廣播 → 200，deleted_at 被設定', async () => {
    const broadcast = await db('broadcasts').whereNull('deleted_at').first();
    const id = broadcast.id;

    const res = await request(app)
      .delete(`/api/broadcasts/${id}`)
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('廣播已下架');

    const deleted = await db('broadcasts').where({ id }).first();
    expect(deleted.deleted_at).not.toBeNull();
  });

  // @validation — 不存在的 id
  it('不存在的 id → 404 BROADCAST_NOT_FOUND', async () => {
    const res = await request(app)
      .delete('/api/broadcasts/99999')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('BROADCAST_NOT_FOUND');
  });

  // @validation — 已下架的 id
  it('已下架的 id → 404 BROADCAST_NOT_FOUND', async () => {
    // 先下架一筆
    const broadcast = await db('broadcasts').whereNull('deleted_at').first();
    if (!broadcast) return;
    await db('broadcasts').where({ id: broadcast.id }).update({ deleted_at: db.fn.now() });

    const res = await request(app)
      .delete(`/api/broadcasts/${broadcast.id}`)
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('BROADCAST_NOT_FOUND');
  });

  // @permissions
  it('general_manager → 403', async () => {
    const broadcast = await db('broadcasts').whereNull('deleted_at').first();
    const id = broadcast?.id ?? 1;

    const res = await request(app)
      .delete(`/api/broadcasts/${id}`)
      .set('Authorization', `Bearer ${generalToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_INSUFFICIENT_PERMISSIONS');
  });

  // @permissions
  it('未帶 token → 401', async () => {
    const res = await request(app).delete('/api/broadcasts/1');
    expect(res.status).toBe(401);
  });
});

describe('Operation logs', () => {
  it('POST 後 CREATE_BROADCAST 操作紀錄寫入', async () => {
    const logs = await db('operation_logs').where('operation_type', 'CREATE_BROADCAST');
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  it('DELETE 後 DELETE_BROADCAST 操作紀錄寫入', async () => {
    const logs = await db('operation_logs').where('operation_type', 'DELETE_BROADCAST');
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });
});
