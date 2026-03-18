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

function hoursAgo(base: Date, hours: number): string {
  const d = new Date(base);
  d.setHours(d.getHours() - hours);
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

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
    { id: 'room_a', name: 'Room A', online_user_count: 10 },
    { id: 'room_b', name: 'Room B', online_user_count: 20 },
  ]);

  // 插入測試用玩家
  await db('players').insert([
    { username: 'player001', nickname: 'LuckyBoy' },
    { username: 'player002', nickname: 'BigWinner' },
    { username: 'player003', nickname: 'StarPlayer' },
  ]);

  // 插入測試用訊息
  const now = new Date();
  await db('chat_messages').insert([
    {
      chatroom_id: 'room_a',
      player_username: 'player001',
      message: '大家好',
      created_at: hoursAgo(now, 1),
    },
    {
      chatroom_id: 'room_a',
      player_username: 'player002',
      message: '恭喜贏了',
      created_at: hoursAgo(now, 2),
    },
    {
      chatroom_id: 'room_b',
      player_username: 'player001',
      message: '換個房間',
      created_at: hoursAgo(now, 3),
    },
    {
      chatroom_id: 'room_a',
      player_username: 'player003',
      message: '好刺激',
      created_at: hoursAgo(now, 48),
    },
    {
      chatroom_id: 'room_a',
      player_username: 'player001',
      message: '已刪除訊息',
      created_at: hoursAgo(now, 5),
      deleted_at: hoursAgo(now, 4),
    },
  ]);
});

afterAll(async () => {
  await closeTestDb();
});

describe('GET /api/chat_messages', () => {
  // @happy_path
  it('預設分頁查詢 → 200 + 資料 + pagination', async () => {
    const res = await request(app)
      .get('/api/chat_messages')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(4); // 排除已刪除
    expect(res.body.pagination).toMatchObject({
      page: 1,
      pageSize: 30,
    });
  });

  // @happy_path
  it('篩選 chatroomId → 精確比對', async () => {
    const res = await request(app)
      .get('/api/chat_messages?chatroomId=room_a')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(3); // room_a 有 3 筆未刪除
    res.body.data.forEach((item: { chatroom_id: string }) => {
      expect(item.chatroom_id).toBe('room_a');
    });
  });

  // @happy_path
  it('篩選 playerUsername → 精確比對', async () => {
    const res = await request(app)
      .get('/api/chat_messages?playerUsername=player001')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2); // player001 有 2 筆未刪除
    res.body.data.forEach((item: { player_username: string }) => {
      expect(item.player_username).toBe('player001');
    });
  });

  // @happy_path
  it('篩選 playerNickname → 模糊搜尋', async () => {
    const res = await request(app)
      .get('/api/chat_messages?playerNickname=Lucky')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    res.body.data.forEach((item: { player_nickname: string }) => {
      expect(item.player_nickname).toContain('Lucky');
    });
  });

  // @happy_path
  it('篩選 message → 模糊搜尋', async () => {
    const res = await request(app)
      .get('/api/chat_messages?message=恭喜')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].message).toContain('恭喜');
  });

  // @happy_path
  it('篩選 startDate + endDate → 範圍查詢', async () => {
    const now = new Date();
    const start = hoursAgo(now, 4);
    const end = hoursAgo(now, 0);

    const res = await request(app)
      .get(`/api/chat_messages?startDate=${start}&endDate=${end}`)
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(3); // 1, 2, 3 小時前的訊息
  });

  // @soft_delete
  it('已軟刪除的訊息不出現在列表中', async () => {
    const res = await request(app)
      .get('/api/chat_messages?message=已刪除訊息')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
  });

  // @happy_path
  it('複合條件篩選 → 同時滿足', async () => {
    const res = await request(app)
      .get('/api/chat_messages?chatroomId=room_a&playerUsername=player001')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1); // room_a + player001 且未刪除
  });

  // @happy_path
  it('紀錄依 created_at 降冪排列', async () => {
    const res = await request(app)
      .get('/api/chat_messages')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    const dates = res.body.data.map((item: { created_at: string }) => item.created_at);
    for (let i = 1; i < dates.length; i++) {
      expect(new Date(dates[i - 1]).getTime()).toBeGreaterThanOrEqual(new Date(dates[i]).getTime());
    }
  });

  // @validation
  it('page 為負數 → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .get('/api/chat_messages?page=-1')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // @permissions
  it('general_manager → 200（有 chat:read 權限）', async () => {
    const res = await request(app)
      .get('/api/chat_messages')
      .set('Authorization', `Bearer ${generalToken}`);

    expect(res.status).toBe(200);
  });

  // @permissions
  it('未帶 token → 401', async () => {
    const res = await request(app).get('/api/chat_messages');

    expect(res.status).toBe(401);
  });

  // @happy_path
  it('回傳資料包含必要欄位', async () => {
    const res = await request(app)
      .get('/api/chat_messages')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    const item = res.body.data[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('chatroom_id');
    expect(item).toHaveProperty('player_username');
    expect(item).toHaveProperty('player_nickname');
    expect(item).toHaveProperty('message');
    expect(item).toHaveProperty('created_at');
  });
});
