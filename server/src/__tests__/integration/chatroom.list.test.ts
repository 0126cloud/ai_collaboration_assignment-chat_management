import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestDb, setupTestSchema, seedTestData, closeTestDb } from '../helpers/testDb';
import { createTestApp, applyErrorHandlers } from '../helpers/testApp';
import { generateToken } from '../helpers/testAuth';
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

  seniorToken = generateToken({ id: 1, username: 'admin01', role: 'senior_manager' });
  generalToken = generateToken({ id: 2, username: 'admin02', role: 'general_manager' });

  // 插入測試用聊天室
  await db('chatrooms').insert([
    { id: 'baccarat_001', name: 'Baccarat Room 1', online_user_count: 120 },
    { id: 'baccarat_002', name: 'Baccarat Room 2', online_user_count: 85 },
    { id: 'blackjack_001', name: 'Blackjack Room 1', online_user_count: 64 },
    { id: 'roulette_001', name: 'Roulette Room 1', online_user_count: 45 },
    { id: 'slots_001', name: 'Slots Room 1', online_user_count: 200 },
    {
      id: 'deleted_room',
      name: 'Deleted Room',
      online_user_count: 0,
      deleted_at: '2026-01-01 00:00:00',
    },
  ]);
});

afterAll(async () => {
  await closeTestDb();
});

describe('GET /api/chatrooms', () => {
  // @happy_path
  it('預設分頁查詢 → 200 + 資料 + pagination', async () => {
    const res = await request(app)
      .get('/api/chatrooms')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(5);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      pageSize: 30,
      total: 5,
      totalPages: 1,
    });
  });

  // @happy_path
  it('自訂 page/pageSize → 正確分頁', async () => {
    const res = await request(app)
      .get('/api/chatrooms?page=1&pageSize=2')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      pageSize: 2,
      total: 5,
      totalPages: 3,
    });
  });

  // @happy_path
  it('搜尋 name → 回傳符合聊天室名稱', async () => {
    const res = await request(app)
      .get('/api/chatrooms?name=Baccarat')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    res.body.data.forEach((item: { name: string }) => {
      expect(item.name).toContain('Baccarat');
    });
  });

  // @happy_path
  it('搜尋 name 也能以 ID 模糊搜尋', async () => {
    const res = await request(app)
      .get('/api/chatrooms?name=blackjack')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe('blackjack_001');
  });

  // @soft_delete
  it('已軟刪除的聊天室不出現在列表中', async () => {
    const res = await request(app)
      .get('/api/chatrooms?name=Deleted')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
  });

  // @validation
  it('無符合結果 → 200 + 空陣列 + total 0', async () => {
    const res = await request(app)
      .get('/api/chatrooms?name=nonexistent')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  // @validation
  it('page 為負數 → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .get('/api/chatrooms?page=-1')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // @permissions
  it('general_manager → 200（有 chatroom:read 權限）', async () => {
    const res = await request(app)
      .get('/api/chatrooms')
      .set('Authorization', `Bearer ${generalToken}`);

    expect(res.status).toBe(200);
  });

  // @permissions
  it('未帶 token → 401', async () => {
    const res = await request(app).get('/api/chatrooms');

    expect(res.status).toBe(401);
  });

  // @happy_path
  it('回傳資料包含必要欄位', async () => {
    const res = await request(app)
      .get('/api/chatrooms')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    const item = res.body.data[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('name');
    expect(item).toHaveProperty('online_user_count');
    expect(item).toHaveProperty('created_at');
    expect(item).toHaveProperty('updated_at');
  });
});
