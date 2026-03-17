import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestDb, setupTestSchema, seedTestData, closeTestDb } from '../helpers/testDb';
import { createTestApp, applyErrorHandlers } from '../helpers/testApp';
import { seniorToken } from '../helpers/testAuth';
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

  // 插入測試用 IP 封鎖資料
  await db('blacklist').insert([
    {
      block_type: 'ip',
      target: '116.62.238.199',
      reason: 'spam',
      operator: 'admin01',
      chatroom_id: '*',
      is_blocked: true,
    },
    {
      block_type: 'ip',
      target: '116.62.238.*',
      reason: 'abuse',
      operator: 'admin02',
      chatroom_id: '*',
      is_blocked: true,
    },
    {
      block_type: 'ip',
      target: '192.168.1.100',
      reason: 'spam',
      operator: 'admin01',
      chatroom_id: 'baccarat_001',
      is_blocked: true,
    },
    // player 紀錄（不應出現在 ip 查詢結果中）
    {
      block_type: 'player',
      target: 'playerTest',
      reason: 'spam',
      operator: 'admin01',
      chatroom_id: '*',
      is_blocked: true,
    },
  ]);
});

afterAll(async () => {
  await closeTestDb();
});

describe('GET /api/blacklist/ip', () => {
  // @happy_path
  it('查詢 IP 封鎖列表 → 200 + 分頁（僅 block_type=ip）', async () => {
    const res = await request(app)
      .get('/api/blacklist/ip')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.every((item: { block_type: string }) => item.block_type === 'ip')).toBe(
      true,
    );
    expect(res.body.pagination.total).toBe(3);
  });

  // @permissions
  it('未帶 token → 401', async () => {
    const res = await request(app).get('/api/blacklist/ip');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/blacklist/ip', () => {
  // @happy_path
  it('封鎖精確 IP → 201', async () => {
    const res = await request(app)
      .post('/api/blacklist/ip')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ target: '10.0.0.1', reason: 'spam' });

    expect(res.status).toBe(201);
    expect(res.body.data.target).toBe('10.0.0.1');
    expect(res.body.data.block_type).toBe('ip');
  });

  // @happy_path
  it('封鎖萬用字元 IP → 201', async () => {
    const res = await request(app)
      .post('/api/blacklist/ip')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ target: '10.0.1.*', reason: 'abuse' });

    expect(res.status).toBe(201);
    expect(res.body.data.target).toBe('10.0.1.*');
  });

  // @validation
  it('IP 格式錯誤（非法字串）→ 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/blacklist/ip')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ target: 'not-ip', reason: 'spam' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // @validation
  it('IP 格式錯誤（中段萬用字元）→ 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/blacklist/ip')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ target: '116.62.*.199', reason: 'spam' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // @validation
  it('重複封鎖 active IP → 409 BLACKLIST_ALREADY_BLOCKED', async () => {
    const res = await request(app)
      .post('/api/blacklist/ip')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ target: '10.0.0.1', reason: 'spam' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BLACKLIST_ALREADY_BLOCKED');
  });
});

describe('DELETE /api/blacklist/ip/:id', () => {
  // @happy_path
  it('解除 IP 封鎖 → 200，is_blocked 改為 false', async () => {
    const postRes = await request(app)
      .post('/api/blacklist/ip')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ target: '10.0.2.1', reason: 'spam' });
    const id = postRes.body.data.id;

    const res = await request(app)
      .delete(`/api/blacklist/ip/${id}`)
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('已成功解封');

    const row = await db('blacklist').where('id', id).first();
    expect(row.is_blocked).toBe(0);
  });
});

describe('Operation logs', () => {
  // @happy_path
  it('封鎖/解封後 operation_logs 有對應紀錄', async () => {
    const postRes = await request(app)
      .post('/api/blacklist/ip')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ target: '10.0.3.1', reason: 'spam' });
    const id = postRes.body.data.id;

    await request(app)
      .delete(`/api/blacklist/ip/${id}`)
      .set('Authorization', `Bearer ${seniorToken}`);

    const blockLogs = await db('operation_logs').where('operation_type', 'BLOCK_IP');
    const unblockLogs = await db('operation_logs').where('operation_type', 'UNBLOCK_IP');

    expect(blockLogs.length).toBeGreaterThanOrEqual(1);
    expect(unblockLogs.length).toBeGreaterThanOrEqual(1);
  });
});
