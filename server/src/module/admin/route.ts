import { Router } from 'express';
import { Knex } from 'knex';
import { createAdminSchema } from '@shared/schemas/admin';
import { validate } from '../../middleware/validate';
import { auth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permission';
import { AdminService } from './service';
import { AdminController } from './controller';

export function createAdminRoutes(db: Knex): Router {
  const router = Router();
  const adminService = new AdminService(db);
  const ctrl = new AdminController(adminService);

  // POST / — 新增管理員
  router.post(
    '/',
    auth,
    requirePermission('admin:create'),
    validate(createAdminSchema),
    ctrl.createAdmin,
  );

  return router;
}
