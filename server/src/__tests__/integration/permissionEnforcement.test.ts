import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Router, Request, Response } from 'express';
import { createTestDb, setupTestSchema, seedTestData, closeTestDb } from '../helpers/testDb';
import { createTestApp, applyErrorHandlers } from '../helpers/testApp';
import { auth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permission';
import { ResponseHelper } from '../../utils/responseHelper';
import type express from 'express';

let app: express.Express;
let seniorToken: string;
let generalToken: string;

beforeAll(async () => {
  const db = createTestDb();
  await setupTestSchema(db);
  await seedTestData(db);
  app = createTestApp(db);

  // 掛載測試用權限路由
  const testRouter = Router();

  testRouter.get(
    '/broadcast-test',
    auth,
    requirePermission('broadcast:create'),
    (_req: Request, res: Response) => {
      ResponseHelper.success(res, { ok: true });
    },
  );

  testRouter.get(
    '/admin-test',
    auth,
    requirePermission('admin:create'),
    (_req: Request, res: Response) => {
      ResponseHelper.success(res, { ok: true });
    },
  );

  app.use('/api/test', testRouter);
  applyErrorHandlers(app);

  // 取得 tokens
  const seniorRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin01', password: '123456' });
  seniorToken = seniorRes.body.data.token;

  const generalRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin02', password: '123456' });
  generalToken = generalRes.body.data.token;
});

afterAll(async () => {
  await closeTestDb();
});

describe('跨角色權限驗證', () => {
  // @permissions
  it('general_manager 存取 broadcast route → 403', async () => {
    const res = await request(app)
      .get('/api/test/broadcast-test')
      .set('Authorization', `Bearer ${generalToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_INSUFFICIENT_PERMISSIONS');
  });

  // @permissions
  it('general_manager 存取 admin route → 403', async () => {
    const res = await request(app)
      .get('/api/test/admin-test')
      .set('Authorization', `Bearer ${generalToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_INSUFFICIENT_PERMISSIONS');
  });

  // @permissions
  it('senior_manager 存取 broadcast route → 通過', async () => {
    const res = await request(app)
      .get('/api/test/broadcast-test')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // @permissions
  it('senior_manager 存取 admin route → 通過', async () => {
    const res = await request(app)
      .get('/api/test/admin-test')
      .set('Authorization', `Bearer ${seniorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
