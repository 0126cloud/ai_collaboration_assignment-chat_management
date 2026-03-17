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

  // 插入測試用操作紀錄
  const now = new Date();
  const records = [
    {
      operation_type: 'CREATE_ADMIN',
      operator_id: 1,
      operator: 'admin01',
      request: JSON.stringify({
        url: '/api/admins',
        method: 'POST',
        payload: { username: 'admin04' },
      }),
      created_at: daysAgo(now, 1),
    },
    {
      operation_type: 'CREATE_ADMIN',
      operator_id: 1,
      operator: 'admin01',
      request: JSON.stringify({
        url: '/api/admins',
        method: 'POST',
        payload: { username: 'admin05' },
      }),
      created_at: daysAgo(now, 5),
    },
    {
      operation_type: 'DELETE_MESSAGE',
      operator_id: 2,
      operator: 'admin02',
      request: JSON.stringify({ url: '/api/messages/101', method: 'DELETE', payload: {} }),
      created_at: daysAgo(now, 2),
    },
    {
      operation_type: 'BLOCK_PLAYER',
      operator_id: 2,
      operator: 'admin02',
      request: JSON.stringify({
        url: '/api/blacklist',
        method: 'POST',
        payload: { playerId: 'player001' },
      }),
      created_at: daysAgo(now, 3),
    },
    {
      operation_type: 'BLOCK_PLAYER',
      operator_id: 1,
      operator: 'admin01',
      request: JSON.stringify({
        url: '/api/blacklist',
        method: 'POST',
        payload: { playerId: 'player002' },
      }),
      created_at: daysAgo(now, 10),
    },
  ];

  await db('operation_logs').insert(records);
});

afterAll(async () => {
  await closeTestDb();
});

function daysAgo(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() - days);
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

describe('GET /api/operation-logs', () => {
  // @happy_path
  it('預設分頁查詢 → 200 + 資料 + pagination', async () => {
    const res = await request(app)
      .get('/api/operation-logs')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(5);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 5,
      totalPages: 1,
    });
  });

  // @happy_path
  it('自訂 page/pageSize → 正確分頁', async () => {
    const res = await request(app)
      .get('/api/operation-logs?page=1&pageSize=2')
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
  it('篩選 operationType → 僅回傳符合類型', async () => {
    const res = await request(app)
      .get('/api/operation-logs?operationType=CREATE_ADMIN')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    res.body.data.forEach((item: { operation_type: string }) => {
      expect(item.operation_type).toBe('CREATE_ADMIN');
    });
  });

  // @happy_path
  it('篩選 operator（模糊搜尋）→ 回傳符合紀錄', async () => {
    const res = await request(app)
      .get('/api/operation-logs?operator=admin02')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    res.body.data.forEach((item: { operator: string }) => {
      expect(item.operator).toContain('admin02');
    });
  });

  // @happy_path
  it('篩選 startDate + endDate → 回傳範圍內紀錄', async () => {
    const now = new Date();
    const start = daysAgo(now, 4);
    const end = daysAgo(now, 0);

    const res = await request(app)
      .get(`/api/operation-logs?startDate=${start}&endDate=${end}`)
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    // 應包含 1, 2, 3 天前的紀錄
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
  });

  // @happy_path
  it('複合條件篩選 → 同時滿足', async () => {
    const res = await request(app)
      .get('/api/operation-logs?operationType=BLOCK_PLAYER&operator=admin02')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].operation_type).toBe('BLOCK_PLAYER');
    expect(res.body.data[0].operator).toBe('admin02');
  });

  // @validation
  it('無符合結果 → 200 + 空陣列 + total 0', async () => {
    const res = await request(app)
      .get('/api/operation-logs?operationType=UNBLOCK_IP')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  // @validation
  it('page 為負數 → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .get('/api/operation-logs?page=-1')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // @permissions
  it('general_manager → 200', async () => {
    const res = await request(app)
      .get('/api/operation-logs')
      .set('Authorization', `Bearer ${generalToken}`);

    expect(res.status).toBe(200);
  });

  // @permissions
  it('senior_manager → 200', async () => {
    const res = await request(app)
      .get('/api/operation-logs')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
  });

  // @permissions
  it('未帶 token → 401', async () => {
    const res = await request(app).get('/api/operation-logs');

    expect(res.status).toBe(401);
  });

  it('紀錄依 created_at 降冪排列', async () => {
    const res = await request(app)
      .get('/api/operation-logs')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    const dates = res.body.data.map((item: { created_at: string }) => item.created_at);
    for (let i = 1; i < dates.length; i++) {
      expect(new Date(dates[i - 1]).getTime()).toBeGreaterThanOrEqual(new Date(dates[i]).getTime());
    }
  });

  it('response 中 request 欄位已 parse 為物件（非 JSON 字串）', async () => {
    const res = await request(app)
      .get('/api/operation-logs')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    const firstItem = res.body.data[0];
    expect(typeof firstItem.request).toBe('object');
    expect(firstItem.request).toHaveProperty('url');
    expect(firstItem.request).toHaveProperty('method');
    expect(firstItem.request).toHaveProperty('payload');
  });
});
