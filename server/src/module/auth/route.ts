import { Router } from 'express';
import { Knex } from 'knex';
import { loginSchema, changePasswordSchema } from '@shared/schemas/auth';
import { validate } from '../../middleware/validate';
import { auth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permission';
import { AuthService } from './service';
import { AuthController } from './controller';

export function createAuthRoutes(db: Knex): Router {
  const router = Router();
  const authService = new AuthService(db);
  const ctrl = new AuthController(authService);

  // POST /login — 登入
  router.post('/login', validate(loginSchema), ctrl.login);

  // PUT /password — 修改自己密碼
  router.put(
    '/password',
    auth,
    requirePermission('auth:change_own_password'),
    validate(changePasswordSchema),
    ctrl.changePassword,
  );

  // GET /permissions — 取得當前使用者權限清單
  router.get('/permissions', auth, ctrl.getPermissions);

  // GET /me — 取得當前使用者資訊 + 權限
  router.get('/me', auth, ctrl.me);

  // POST /logout — 登出（清除 cookie）
  router.post('/logout', auth, ctrl.logout);

  return router;
}
