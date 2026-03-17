import { Router } from 'express';
import { Knex } from 'knex';
import { auth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permission';
import { NicknameReviewService } from './service';
import { NicknameReviewController } from './controller';

export function createNicknameReviewRoutes(db: Knex): Router {
  const router = Router();
  const service = new NicknameReviewService(db);
  const controller = new NicknameReviewController(service);

  router.get('/', auth, requirePermission('nickname:read'), controller.list);
  router.post('/:username/approve', auth, requirePermission('nickname:review'), controller.approve);
  router.post('/:username/reject', auth, requirePermission('nickname:review'), controller.reject);

  return router;
}
