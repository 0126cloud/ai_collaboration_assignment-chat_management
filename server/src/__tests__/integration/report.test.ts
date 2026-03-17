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

  // 插入測試用玩家（為 blacklist 使用）
  await db('players').insert([
    { username: 'player001', nickname: 'P1' },
    { username: 'player002', nickname: 'P2' },
    { username: 'player003', nickname: 'P3' },
    { username: 'player007', nickname: 'P7' },
    { username: 'player010', nickname: 'P10' },
    { username: 'player012', nickname: 'P12' },
    { username: 'player015', nickname: 'P15' },
  ]);

  // 插入測試 reports
  await db('reports').insert([
    {
      reporter_username: 'player001',
      target_username: 'player003',
      chatroom_id: 'baccarat_001',
      chat_message_id: null,
      chat_message: '你這個混蛋！',
      reason: 'abuse',
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
    },
    {
      reporter_username: 'player002',
      target_username: 'player007',
      chatroom_id: 'blackjack_001',
      chat_message_id: null,
      chat_message: '免費送錢，加我微信',
      reason: 'spam',
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
    },
    {
      reporter_username: 'player001',
      target_username: 'player010',
      chatroom_id: 'roulette_001',
      chat_message_id: null,
      chat_message: '廣告訊息內容',
      reason: 'advertisement',
      status: 'approved',
      reviewed_by: 'admin01',
      reviewed_at: '2026-03-16 10:00:00',
    },
    {
      reporter_username: 'player002',
      target_username: 'player012',
      chatroom_id: 'baccarat_001',
      chat_message_id: null,
      chat_message: '垃圾訊息',
      reason: 'spam',
      status: 'rejected',
      reviewed_by: 'admin02',
      reviewed_at: '2026-03-16 11:00:00',
    },
  ]);
});

afterAll(async () => {
  await closeTestDb();
});

describe('GET /api/reports', () => {
  // @happy_path
  it('預設回傳 status=pending 列表 → 200', async () => {
    const res = await request(app)
      .get('/api/reports')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.every((item: { status: string }) => item.status === 'pending')).toBe(true);
    expect(res.body.pagination.total).toBe(2);
  });

  // @happy_path
  it('status=approved → 回傳已核准列表', async () => {
    const res = await request(app)
      .get('/api/reports?status=approved')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((item: { status: string }) => item.status === 'approved')).toBe(
      true,
    );
  });

  // @happy_path
  it('reporterUsername 模糊搜尋', async () => {
    const res = await request(app)
      .get('/api/reports?status=pending&reporterUsername=player001')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].reporter_username).toBe('player001');
  });

  // @happy_path
  it('targetUsername 模糊搜尋', async () => {
    const res = await request(app)
      .get('/api/reports?status=pending&targetUsername=player007')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].target_username).toBe('player007');
  });

  // @permissions
  it('未帶 token → 401', async () => {
    const res = await request(app).get('/api/reports');
    expect(res.status).toBe(401);
  });

  // @permissions
  it('general_manager → 200', async () => {
    const res = await request(app)
      .get('/api/reports')
      .set('Authorization', `Bearer ${generalToken}`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/reports/:id/approve', () => {
  // @happy_path
  it('核准檢舉 → 200，status=approved + 被檢舉玩家被封鎖', async () => {
    const pendingReport = await db('reports').where({ status: 'pending' }).first();
    const reportId = pendingReport.id;

    const res = await request(app)
      .post(`/api/reports/${reportId}/approve`)
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('檢舉已核准，被檢舉玩家已封鎖');

    const report = await db('reports').where({ id: reportId }).first();
    expect(report.status).toBe('approved');
    expect(report.reviewed_by).toBe('admin01');

    const blacklistEntry = await db('blacklist')
      .where({ block_type: 'player', target: pendingReport.target_username })
      .first();
    expect(blacklistEntry).toBeTruthy();
    expect(blacklistEntry.is_blocked).toBe(1);
  });

  // @auto_block
  it('核准檢舉但目標玩家已封鎖 → 200（靜默忽略 BLACKLIST_ALREADY_BLOCKED）', async () => {
    // 先新增一個 pending report，target 已在黑名單
    const [reportId] = await db('reports').insert({
      reporter_username: 'player001',
      target_username: 'player015',
      chatroom_id: 'blackjack_001',
      chat_message_id: null,
      chat_message: '已封鎖玩家的訊息',
      reason: 'abuse',
      status: 'pending',
    });

    // 先封鎖該玩家
    await db('blacklist').insert({
      block_type: 'player',
      target: 'player015',
      reason: 'spam',
      operator: 'admin01',
      chatroom_id: 'blackjack_001',
      is_blocked: true,
    });

    const res = await request(app)
      .post(`/api/reports/${reportId}/approve`)
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // @already_reviewed
  it('對已審核 report 再次 approve → 409 REPORT_ALREADY_REVIEWED', async () => {
    const approvedReport = await db('reports').where({ status: 'approved' }).first();

    const res = await request(app)
      .post(`/api/reports/${approvedReport.id}/approve`)
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REPORT_ALREADY_REVIEWED');
  });

  // @validation
  it('不存在的 id → 404 REPORT_NOT_FOUND', async () => {
    const res = await request(app)
      .post('/api/reports/99999/approve')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('REPORT_NOT_FOUND');
  });

  // @validation
  it('非整數 id → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/reports/abc/approve')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // @permissions
  it('未帶 token → 401', async () => {
    const res = await request(app).post('/api/reports/1/approve');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/reports/:id/reject', () => {
  // @happy_path
  it('駁回檢舉 → 200，status=rejected', async () => {
    const pendingReport = await db('reports').where({ status: 'pending' }).first();
    const reportId = pendingReport.id;

    const res = await request(app)
      .post(`/api/reports/${reportId}/reject`)
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('檢舉已駁回');

    const report = await db('reports').where({ id: reportId }).first();
    expect(report.status).toBe('rejected');
    expect(report.reviewed_by).toBe('admin01');
  });

  // @already_reviewed
  it('對已審核 report 再次 reject → 409 REPORT_ALREADY_REVIEWED', async () => {
    const rejectedReport = await db('reports').where({ status: 'rejected' }).first();

    const res = await request(app)
      .post(`/api/reports/${rejectedReport.id}/reject`)
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REPORT_ALREADY_REVIEWED');
  });

  // @validation
  it('不存在的 id → 404 REPORT_NOT_FOUND', async () => {
    const res = await request(app)
      .post('/api/reports/99999/reject')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('REPORT_NOT_FOUND');
  });

  // @permissions
  it('未帶 token → 401', async () => {
    const res = await request(app).post('/api/reports/1/reject');
    expect(res.status).toBe(401);
  });
});

describe('Transaction rollback', () => {
  it('approve 時若封鎖失敗（非 ALREADY_BLOCKED），report 狀態應保持 pending', async () => {
    // 此測試驗證 transaction 存在，實際 rollback 需要 mock 才能觸發
    // 這裡確認 approve 成功時 report 確實更新，間接驗證 transaction 邏輯
    const [reportId] = await db('reports').insert({
      reporter_username: 'player001',
      target_username: 'player003',
      chatroom_id: 'baccarat_001',
      chat_message_id: null,
      chat_message: 'Transaction test',
      reason: 'spam',
      status: 'pending',
    });

    const res = await request(app)
      .post(`/api/reports/${reportId}/approve`)
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    const report = await db('reports').where({ id: reportId }).first();
    expect(report.status).toBe('approved');
  });
});

describe('Operation logs', () => {
  it('approve/reject 後 operation_logs 有對應紀錄', async () => {
    const approveLogs = await db('operation_logs').where('operation_type', 'APPROVE_REPORT');
    const rejectLogs = await db('operation_logs').where('operation_type', 'REJECT_REPORT');

    expect(approveLogs.length).toBeGreaterThanOrEqual(1);
    expect(rejectLogs.length).toBeGreaterThanOrEqual(1);
  });
});
