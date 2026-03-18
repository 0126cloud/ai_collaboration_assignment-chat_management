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

  // 插入測試玩家
  await db('players').insert([
    {
      username: 'player123',
      nickname: 'LuckyBoy',
      nickname_review_status: 'approved',
      nickname_apply_at: '2026-03-15 10:00:00',
    },
    {
      username: 'player456',
      nickname: 'player456',
      nickname_review_status: null,
      nickname_apply_at: null,
    },
  ]);
});

afterAll(async () => {
  await closeTestDb();
});

describe('PUT /api/players/:username/nickname/reset', () => {
  // @happy_path
  it('重設暱稱 → 200，nickname=username，nickname_review_status=null', async () => {
    const res = await request(app)
      .put('/api/players/player123/nickname/reset')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('暱稱已重設');

    const player = await db('players').where({ username: 'player123' }).first();
    expect(player.nickname).toBe('player123');
    expect(player.nickname_review_status).toBeNull();
  });

  // @validation
  it('玩家不存在 → 404 PLAYER_NOT_FOUND', async () => {
    const res = await request(app)
      .put('/api/players/nonexistent/nickname/reset')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PLAYER_NOT_FOUND');
  });

  // @permissions
  it('未帶 token → 401', async () => {
    const res = await request(app).put('/api/players/player456/nickname/reset');
    expect(res.status).toBe(401);
  });

  // @permissions
  it('general_manager 可重設暱稱 → 200', async () => {
    const res = await request(app)
      .put('/api/players/player456/nickname/reset')
      .set('Authorization', `Bearer ${generalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Operation logs — resetNickname', () => {
  // @happy_path
  it('重設暱稱後 operation_logs 有 RESET_NICKNAME 紀錄', async () => {
    const logs = await db('operation_logs').where('operation_type', 'RESET_NICKNAME');
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });
});
