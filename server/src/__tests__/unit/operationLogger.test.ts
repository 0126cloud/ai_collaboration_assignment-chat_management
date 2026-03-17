import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Request, Response } from 'express';
import { Knex } from 'knex';
import { createTestDb, setupTestSchema, closeTestDb } from '../helpers/testDb';
import { operationLogger, sanitizePayload } from '../../middleware/operationLogger';

let db: Knex;

beforeAll(async () => {
  db = createTestDb();
  await setupTestSchema(db);
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await db('operation_logs').del();
});

// 建立測試用 app
function createApp(handler: (req: Request, res: Response) => void) {
  const app = express();
  app.use(express.json());
  app.locals.db = db;
  app.use(operationLogger);

  // 模擬 auth middleware 設定 req.user
  app.use((req: Request, _res: Response, next) => {
    req.user = { id: 1, username: 'admin01', role: 'senior_manager' };
    next();
  });

  app.post('/test', handler);
  return app;
}

describe('operationLogger middleware', () => {
  it('有 res.locals.operationLog + 2xx 狀態碼 → 寫入 DB', async () => {
    const app = createApp((_req: Request, res: Response) => {
      res.locals.operationLog = { operationType: 'CREATE_ADMIN' };
      res.status(201).json({ success: true });
    });

    await request(app).post('/test').send({ username: 'admin04', role: 'general_manager' });

    // 等待 finish 事件中的非同步寫入完成
    await new Promise((resolve) => setTimeout(resolve, 100));

    const logs = await db('operation_logs').select('*');
    expect(logs).toHaveLength(1);
    expect(logs[0].operation_type).toBe('CREATE_ADMIN');
    expect(logs[0].operator_id).toBe(1);
    expect(logs[0].operator).toBe('admin01');

    const reqData = JSON.parse(logs[0].request);
    expect(reqData.url).toBe('/test');
    expect(reqData.method).toBe('POST');
    expect(reqData.payload).toEqual({ username: 'admin04', role: 'general_manager' });
  });

  it('無 res.locals.operationLog → 不寫入', async () => {
    const app = createApp((_req: Request, res: Response) => {
      res.status(200).json({ success: true });
    });

    await request(app).post('/test').send({});
    await new Promise((resolve) => setTimeout(resolve, 100));

    const logs = await db('operation_logs').select('*');
    expect(logs).toHaveLength(0);
  });

  it('4xx 狀態碼 → 不寫入', async () => {
    const app = createApp((_req: Request, res: Response) => {
      res.locals.operationLog = { operationType: 'CREATE_ADMIN' };
      res.status(400).json({ success: false });
    });

    await request(app).post('/test').send({});
    await new Promise((resolve) => setTimeout(resolve, 100));

    const logs = await db('operation_logs').select('*');
    expect(logs).toHaveLength(0);
  });

  it('DB 寫入失敗 → 不拋出錯誤（靜默處理）', async () => {
    const app = express();
    app.use(express.json());
    // 故意不掛載 db，使寫入失敗
    app.locals.db = null;
    app.use(operationLogger);
    app.use((req: Request, _res: Response, next) => {
      req.user = { id: 1, username: 'admin01', role: 'senior_manager' };
      next();
    });
    app.post('/test', (_req: Request, res: Response) => {
      res.locals.operationLog = { operationType: 'CREATE_ADMIN' };
      res.status(201).json({ success: true });
    });

    // 不應拋出錯誤
    const res = await request(app).post('/test').send({});
    expect(res.status).toBe(201);
  });
});

describe('sanitizePayload', () => {
  it('過濾敏感欄位（password → ***）', () => {
    const result = sanitizePayload({
      username: 'admin04',
      password: 'secret123',
      role: 'general_manager',
    });

    expect(result.username).toBe('admin04');
    expect(result.password).toBe('***');
    expect(result.role).toBe('general_manager');
  });

  it('過濾多個敏感欄位', () => {
    const result = sanitizePayload({
      oldPassword: 'old123',
      newPassword: 'new456',
      password_hash: 'hash789',
    });

    expect(result.oldPassword).toBe('***');
    expect(result.newPassword).toBe('***');
    expect(result.password_hash).toBe('***');
  });

  it('無敏感欄位時不修改', () => {
    const input = { username: 'admin04', role: 'general_manager' };
    const result = sanitizePayload(input);
    expect(result).toEqual(input);
  });
});
