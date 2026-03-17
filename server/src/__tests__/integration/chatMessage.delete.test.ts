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

  // 插入測試用聊天室與訊息
  await db('chatrooms').insert([
    { id: 'del_room', name: 'Delete Test Room', online_user_count: 0 },
  ]);

  await db('chat_messages').insert([
    {
      chatroom_id: 'del_room',
      player_username: 'player001',
      player_nickname: 'TestPlayer',
      message: '待刪除訊息 1',
    },
    {
      chatroom_id: 'del_room',
      player_username: 'player001',
      player_nickname: 'TestPlayer',
      message: '待刪除訊息 2',
    },
    {
      chatroom_id: 'del_room',
      player_username: 'player001',
      player_nickname: 'TestPlayer',
      message: '已刪除訊息',
      deleted_at: '2026-01-01 00:00:00',
    },
  ]);
});

afterAll(async () => {
  await closeTestDb();
});

describe('DELETE /api/chat_messages/:id', () => {
  // @happy_path
  it('軟刪除成功 → 200 + 成功訊息', async () => {
    const res = await request(app)
      .delete('/api/chat_messages/1')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('訊息已刪除');
  });

  // @soft_delete
  it('軟刪除後 deleted_at 被設值', async () => {
    const row = await db('chat_messages').where('id', 1).first();
    expect(row.deleted_at).not.toBeNull();
  });

  // @soft_delete
  it('已軟刪除的訊息不出現在 GET 列表中', async () => {
    const res = await request(app)
      .get('/api/chat_messages?message=待刪除訊息 1')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
  });

  // @integration
  it('刪除後 operation_logs 有紀錄', async () => {
    // 先刪除第 2 筆訊息
    await request(app).delete('/api/chat_messages/2').set('Authorization', `Bearer ${seniorToken}`);

    const logs = await db('operation_logs').where('operation_type', 'DELETE_MESSAGE');
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  // @error_handling
  it('訊息不存在 → 404 CHAT_MESSAGE_NOT_FOUND', async () => {
    const res = await request(app)
      .delete('/api/chat_messages/99999')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CHAT_MESSAGE_NOT_FOUND');
  });

  // @error_handling
  it('已軟刪除的訊息再次刪除 → 404', async () => {
    const res = await request(app)
      .delete('/api/chat_messages/3')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CHAT_MESSAGE_NOT_FOUND');
  });

  // @permissions
  it('general_manager → 200（有 chat:delete 權限）', async () => {
    // 先插入一筆新訊息供刪除
    await db('chat_messages').insert({
      chatroom_id: 'del_room',
      player_username: 'player001',
      player_nickname: 'TestPlayer',
      message: 'GM 刪除測試',
    });
    const msg = await db('chat_messages').where('message', 'GM 刪除測試').first();

    const res = await request(app)
      .delete(`/api/chat_messages/${msg.id}`)
      .set('Authorization', `Bearer ${generalToken}`);

    expect(res.status).toBe(200);
  });

  // @permissions
  it('未帶 token → 401', async () => {
    const res = await request(app).delete('/api/chat_messages/1');

    expect(res.status).toBe(401);
  });
});
