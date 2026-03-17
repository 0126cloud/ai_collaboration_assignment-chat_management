import { Router } from 'express';
import { Knex } from 'knex';
import { auth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permission';
import { BlacklistService } from '../blacklist/service';
import { ReportService } from './service';
import { ReportController } from './controller';

export function createReportRoutes(db: Knex): Router {
  const router = Router();
  const blacklistService = new BlacklistService(db);
  const service = new ReportService(db, blacklistService);
  const controller = new ReportController(service);

  router.get('/', auth, requirePermission('report:read'), controller.list);
  router.post('/:id/approve', auth, requirePermission('report:review'), controller.approve);
  router.post('/:id/reject', auth, requirePermission('report:review'), controller.reject);

  return router;
}
