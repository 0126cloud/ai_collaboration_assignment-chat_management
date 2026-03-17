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
      username: 'player016',
      nickname: 'DragonKing',
      nickname_review_status: 'pending',
      nickname_apply_at: '2026-03-15 10:00:00',
    },
    {
      username: 'player017',
      nickname: 'LuckyStrike99',
      nickname_review_status: 'pending',
      nickname_apply_at: '2026-03-15 11:30:00',
    },
    {
      username: 'player018',
      nickname: 'PokerGod777',
      nickname_review_status: 'pending',
      nickname_apply_at: '2026-03-16 09:00:00',
    },
    {
      username: 'player019',
      nickname: 'CasinoMaster',
      nickname_review_status: 'pending',
      nickname_apply_at: '2026-03-16 14:00:00',
    },
    {
      username: 'player020',
      nickname: 'GoldenChip_X',
      nickname_review_status: 'pending',
      nickname_apply_at: '2026-03-17 08:00:00',
    },
    {
      username: 'player021',
      nickname: 'ApprovedPlayer',
      nickname_review_status: 'approved',
      nickname_apply_at: null,
    },
    {
      username: 'deletedPlayer',
      nickname: 'Ghost',
      nickname_review_status: 'pending',
      nickname_apply_at: '2026-03-17 08:00:00',
      deleted_at: '2026-03-17 08:00:00',
    },
  ]);
});

afterAll(async () => {
  await closeTestDb();
});

describe('GET /api/nickname_reviews', () => {
  // @happy_path
  it('列出待審核暱稱 → 200 + 僅回傳 nickname_review_status=pending', async () => {
    const res = await request(app)
      .get('/api/nickname_reviews')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(5);
    expect(res.body.pagination.total).toBe(5);
    // 按 nickname_apply_at ASC 排序
    expect(res.body.data[0].username).toBe('player016');
  });

  // @happy_path
  it('username 模糊搜尋 → 回傳匹配結果', async () => {
    const res = await request(app)
      .get('/api/nickname_reviews?username=player01')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(
      res.body.data.every((item: { username: string }) => item.username.includes('player01')),
    ).toBe(true);
  });

  // @happy_path
  it('nickname 模糊搜尋 → 回傳匹配結果', async () => {
    const res = await request(app)
      .get('/api/nickname_reviews?nickname=Dragon')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].nickname).toBe('DragonKing');
  });

  // @happy_path
  it('日期範圍篩選 → 只回傳範圍內資料', async () => {
    const res = await request(app)
      .get(
        '/api/nickname_reviews?applyStartDate=2026-03-16 00:00:00&applyEndDate=2026-03-16 23:59:59',
      )
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });

  // @permissions
  it('未帶 token → 401', async () => {
    const res = await request(app).get('/api/nickname_reviews');
    expect(res.status).toBe(401);
  });

  // @permissions
  it('general_manager → 200', async () => {
    const res = await request(app)
      .get('/api/nickname_reviews')
      .set('Authorization', `Bearer ${generalToken}`);
    expect(res.status).toBe(200);
  });

  // @happy_path
  it('status=approved 篩選 → 回傳已核准列表', async () => {
    const res = await request(app)
      .get('/api/nickname_reviews?status=approved')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // player021 是 approved 狀態
    expect(
      res.body.data.every(
        (item: { nickname_review_status: string }) => item.nickname_review_status === 'approved',
      ),
    ).toBe(true);
  });
});

describe('POST /api/nickname_reviews/:username/approve', () => {
  // @happy_path
  it('核准暱稱 → 200，nickname_review_status=approved，nickname_apply_at 保留', async () => {
    const res = await request(app)
      .post('/api/nickname_reviews/player016/approve')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('暱稱申請已核准');

    const player = await db('players').where({ username: 'player016' }).first();
    expect(player.nickname_review_status).toBe('approved');
    expect(player.nickname_reviewed_by).toBeTruthy();
    expect(player.nickname_apply_at).toBeTruthy();
    // 暱稱保持不變
    expect(player.nickname).toBe('DragonKing');
  });

  // @validation
  it('對已核准玩家再次 approve → 409 PLAYER_NICKNAME_NOT_PENDING', async () => {
    const res = await request(app)
      .post('/api/nickname_reviews/player016/approve')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PLAYER_NICKNAME_NOT_PENDING');
  });

  // @validation
  it('玩家不存在 → 404 PLAYER_NOT_FOUND', async () => {
    const res = await request(app)
      .post('/api/nickname_reviews/nonexistent/approve')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PLAYER_NOT_FOUND');
  });

  // @permissions
  it('未帶 token → 401', async () => {
    const res = await request(app).post('/api/nickname_reviews/player017/approve');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/nickname_reviews/:username/reject', () => {
  // @happy_path
  it('駁回暱稱 → 200，nickname=username，nickname_review_status=rejected，nickname_apply_at 保留', async () => {
    const res = await request(app)
      .post('/api/nickname_reviews/player017/reject')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('暱稱申請已駁回，暱稱已重設為帳號名稱');

    const player = await db('players').where({ username: 'player017' }).first();
    expect(player.nickname_review_status).toBe('rejected');
    expect(player.nickname_apply_at).toBeTruthy();
    expect(player.nickname).toBe('player017');
  });

  // @validation
  it('對已審核玩家再次 reject → 409 PLAYER_NICKNAME_NOT_PENDING', async () => {
    const res = await request(app)
      .post('/api/nickname_reviews/player017/reject')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PLAYER_NICKNAME_NOT_PENDING');
  });

  // @permissions
  it('未帶 token → 401', async () => {
    const res = await request(app).post('/api/nickname_reviews/player018/reject');
    expect(res.status).toBe(401);
  });
});

describe('Operation logs', () => {
  // @happy_path
  it('approve/reject 後 operation_logs 有對應紀錄', async () => {
    await request(app)
      .post('/api/nickname_reviews/player018/approve')
      .set('Authorization', `Bearer ${seniorToken}`);

    await request(app)
      .post('/api/nickname_reviews/player019/reject')
      .set('Authorization', `Bearer ${seniorToken}`);

    const approveLogs = await db('operation_logs').where('operation_type', 'APPROVE_NICKNAME');
    const rejectLogs = await db('operation_logs').where('operation_type', 'REJECT_NICKNAME');

    expect(approveLogs.length).toBeGreaterThanOrEqual(1);
    expect(rejectLogs.length).toBeGreaterThanOrEqual(1);
  });
});
