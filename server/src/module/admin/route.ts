import { Router } from 'express';
import { Knex } from 'knex';
import {
  createAdminSchema,
  updateAdminRoleSchema,
  resetAdminPasswordSchema,
} from '@shared/schemas/admin';
import { validate } from '../../middleware/validate';
import { auth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permission';
import { AdminService } from './service';
import { AdminController } from './controller';

export function createAdminRoutes(db: Knex): Router {
  const router = Router();
  const adminService = new AdminService(db);
  const ctrl = new AdminController(adminService);

  // GET / — 取得管理員列表
  router.get('/', auth, requirePermission('admin:read'), ctrl.list);

  // POST / — 新增管理員
  router.post(
    '/',
    auth,
    requirePermission('admin:create'),
    validate(createAdminSchema),
    ctrl.createAdmin,
  );

  // PUT /:id/toggle — 啟用/停用管理員
  router.put('/:id/toggle', auth, requirePermission('admin:toggle'), ctrl.toggle);

  // PATCH /:id/role — 更新管理員角色
  router.patch(
    '/:id/role',
    auth,
    requirePermission('admin:toggle'),
    validate(updateAdminRoleSchema),
    ctrl.updateRole,
  );

  // PUT /:id/password — 重設管理員密碼
  router.put(
    '/:id/password',
    auth,
    requirePermission('admin:reset_password'),
    validate(resetAdminPasswordSchema),
    ctrl.resetPassword,
  );

  return router;
}
