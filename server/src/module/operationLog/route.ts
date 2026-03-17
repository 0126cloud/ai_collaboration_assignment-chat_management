import { Router } from 'express';
import { Knex } from 'knex';
import { auth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permission';
import { OperationLogService } from './service';
import { OperationLogController } from './controller';

export function createOperationLogRoutes(db: Knex): Router {
  const router = Router();
  const service = new OperationLogService(db);
  const ctrl = new OperationLogController(service);

  // GET / — 查詢操作紀錄列表
  router.get('/', auth, requirePermission('operation_log:read'), ctrl.list);

  return router;
}
