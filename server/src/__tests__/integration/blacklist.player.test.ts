import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestDb, setupTestSchema, seedTestData, closeTestDb } from '../helpers/testDb';
import { createTestApp, applyErrorHandlers } from '../helpers/testApp';
import { seniorToken, generalToken } from '../helpers/testAuth';
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

  // 插入測試用玩家黑名單資料
  await db('blacklist').insert([
    {
      block_type: 'player',
      target: 'player03',
      reason: 'spam',
      operator: 'admin01',
      chatroom_id: 'baccarat_001',
      is_blocked: true,
    },
    {
      block_type: 'player',
      target: 'player07',
      reason: 'abuse',
      operator: 'admin01',
      chatroom_id: 'all',
      is_blocked: true,
    },
    {
      block_type: 'player',
      target: 'player10',
      reason: 'advertisement',
      operator: 'admin02',
      chatroom_id: 'blackjack_001',
      is_blocked: true,
    },
    {
      block_type: 'player',
      target: 'player12',
      reason: 'spam',
      operator: 'admin02',
      chatroom_id: 'roulette_001',
      is_blocked: true,
    },
    {
      block_type: 'player',
      target: 'player15',
      reason: 'abuse',
      operator: 'admin01',
      chatroom_id: 'all',
      is_blocked: true,
    },
    // IP 紀錄（不應出現在 player 查詢結果中）
    {
      block_type: 'ip',
      target: '192.168.1.1',
      reason: 'spam',
      operator: 'admin01',
      chatroom_id: 'all',
      is_blocked: true,
    },
  ]);
});

afterAll(async () => {
  await closeTestDb();
});

describe('GET /api/blacklist/player', () => {
  // @happy_path
  it('查詢玩家黑名單 → 200 + 分頁（僅 block_type=player）', async () => {
    const res = await request(app)
      .get('/api/blacklist/player')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(5);
    expect(
      res.body.data.every((item: { block_type: string }) => item.block_type === 'player'),
    ).toBe(true);
    expect(res.body.pagination.total).toBe(5);
  });

  // @happy_path
  it('target 模糊搜尋 → 回傳匹配結果', async () => {
    const res = await request(app)
      .get('/api/blacklist/player?target=player0')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((item: { target: string }) => item.target.includes('player0'))).toBe(
      true,
    );
  });

  // @happy_path
  it('reason 精確篩選 → 回傳對應原因的紀錄', async () => {
    const res = await request(app)
      .get('/api/blacklist/player?reason=spam')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((item: { reason: string }) => item.reason === 'spam')).toBe(true);
  });

  // @happy_path
  it('startDate/endDate 日期範圍篩選', async () => {
    const res = await request(app)
      .get('/api/blacklist/player?startDate=2000-01-01&endDate=2099-12-31')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(5);
  });

  // @happy_path
  it('status=all → 回傳封鎖中與已解封所有紀錄', async () => {
    // 先解封一筆
    const postRes = await request(app)
      .post('/api/blacklist/player')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ target: 'playerForStatusAll', reason: 'spam' });
    const id = postRes.body.data.id;
    await request(app)
      .delete(`/api/blacklist/player/${id}`)
      .set('Authorization', `Bearer ${seniorToken}`);

    const resAll = await request(app)
      .get('/api/blacklist/player?status=all')
      .set('Authorization', `Bearer ${seniorToken}`);
    const resBlocked = await request(app)
      .get('/api/blacklist/player?status=blocked')
      .set('Authorization', `Bearer ${seniorToken}`);
    const resUnblocked = await request(app)
      .get('/api/blacklist/player?status=unblocked')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(resAll.status).toBe(200);
    expect(resBlocked.status).toBe(200);
    expect(resUnblocked.status).toBe(200);
    expect(resAll.body.pagination.total).toBeGreaterThan(resBlocked.body.pagination.total);
    expect(resUnblocked.body.data.length).toBeGreaterThan(0);
    expect(
      resUnblocked.body.data.every((item: { is_blocked: number | boolean }) => !item.is_blocked),
    ).toBe(true);
  });

  // @permissions
  it('未帶 token → 401', async () => {
    const res = await request(app).get('/api/blacklist/player');
    expect(res.status).toBe(401);
  });

  // @permissions
  it('general_manager → 200', async () => {
    const res = await request(app)
      .get('/api/blacklist/player')
      .set('Authorization', `Bearer ${generalToken}`);
    expect(res.status).toBe(200);
  });

  // @permissions
  it('senior_manager → 200', async () => {
    const res = await request(app)
      .get('/api/blacklist/player')
      .set('Authorization', `Bearer ${seniorToken}`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/blacklist/player', () => {
  // @happy_path
  it('封鎖玩家（新紀錄）→ 201', async () => {
    const res = await request(app)
      .post('/api/blacklist/player')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ target: 'playerXX', reason: 'spam' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.target).toBe('playerXX');
    expect(res.body.data.block_type).toBe('player');
    expect(res.body.data.is_blocked).toBeTruthy();
  });

  // @happy_path
  it('封鎖玩家（全域，預設 chatroom_id=all）→ 201', async () => {
    const res = await request(app)
      .post('/api/blacklist/player')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ target: 'playerYY', reason: 'abuse' });

    expect(res.status).toBe(201);
    expect(res.body.data.chatroom_id).toBe('all');
  });

  // @validation
  it('重複封鎖 active 紀錄 → 409 BLACKLIST_ALREADY_BLOCKED', async () => {
    const res = await request(app)
      .post('/api/blacklist/player')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ target: 'playerXX', reason: 'spam' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BLACKLIST_ALREADY_BLOCKED');
  });

  // @soft_delete
  it('封鎖已解封玩家 → 201，is_blocked 改為 true', async () => {
    // 先新增並解封
    const postRes = await request(app)
      .post('/api/blacklist/player')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ target: 'playerZZ', reason: 'spam' });
    expect(postRes.status).toBe(201);

    const id = postRes.body.data.id;
    await request(app)
      .delete(`/api/blacklist/player/${id}`)
      .set('Authorization', `Bearer ${seniorToken}`);

    // 重新封鎖
    const reRes = await request(app)
      .post('/api/blacklist/player')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ target: 'playerZZ', reason: 'spam' });

    expect(reRes.status).toBe(201);
    const row = await db('blacklist').where('id', id).first();
    expect(row.is_blocked).toBe(1);
  });
});

describe('DELETE /api/blacklist/player/:id', () => {
  // @happy_path
  it('解封玩家 → 200，is_blocked 改為 false', async () => {
    const postRes = await request(app)
      .post('/api/blacklist/player')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ target: 'playerToUnblock', reason: 'spam' });
    const id = postRes.body.data.id;

    const res = await request(app)
      .delete(`/api/blacklist/player/${id}`)
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('已成功解封');

    const row = await db('blacklist').where('id', id).first();
    expect(row.is_blocked).toBe(0);
  });

  // @soft_delete
  it('解封後玩家不出現在預設列表（status=blocked）', async () => {
    const postRes = await request(app)
      .post('/api/blacklist/player')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ target: 'playerToHide', reason: 'spam' });
    const id = postRes.body.data.id;

    await request(app)
      .delete(`/api/blacklist/player/${id}`)
      .set('Authorization', `Bearer ${seniorToken}`);

    const listRes = await request(app)
      .get('/api/blacklist/player?target=playerToHide')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(listRes.body.data.length).toBe(0);
  });

  // @validation
  it('解封不存在 id → 404 BLACKLIST_ENTRY_NOT_FOUND', async () => {
    const res = await request(app)
      .delete('/api/blacklist/player/99999')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('BLACKLIST_ENTRY_NOT_FOUND');
  });

  // @validation
  it('解封 ip 類型的 id 用 player 路由 → 404', async () => {
    const ipEntry = await db('blacklist').where('block_type', 'ip').first();

    const res = await request(app)
      .delete(`/api/blacklist/player/${ipEntry.id}`)
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('BLACKLIST_ENTRY_NOT_FOUND');
  });
});

describe('Operation logs', () => {
  // @happy_path
  it('封鎖/解封後 operation_logs 有對應紀錄', async () => {
    const postRes = await request(app)
      .post('/api/blacklist/player')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({ target: 'playerOpLog', reason: 'spam' });
    const id = postRes.body.data.id;

    await request(app)
      .delete(`/api/blacklist/player/${id}`)
      .set('Authorization', `Bearer ${seniorToken}`);

    const blockLogs = await db('operation_logs').where('operation_type', 'BLOCK_PLAYER');
    const unblockLogs = await db('operation_logs').where('operation_type', 'UNBLOCK_PLAYER');

    expect(blockLogs.length).toBeGreaterThanOrEqual(1);
    expect(unblockLogs.length).toBeGreaterThanOrEqual(1);
  });
});
