import { Router } from 'express';
import { Knex } from 'knex';
import { auth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permission';
import { PlayerService } from './service';
import { PlayerController } from './controller';

export function createPlayerRoutes(db: Knex): Router {
  const router = Router();
  const playerService = new PlayerService(db);
  const ctrl = new PlayerController(playerService);

  // PUT /:username/nickname/reset — 重設玩家暱稱
  router.put(
    '/:username/nickname/reset',
    auth,
    requirePermission('player:reset_nickname'),
    ctrl.resetNickname,
  );

  // GET /nickname/reviews — 暱稱審核列表
  router.get(
    '/nickname/reviews',
    auth,
    requirePermission('nickname:read'),
    ctrl.listNicknameReviews,
  );

  // POST /:username/nickname/approve — 核准暱稱
  router.post(
    '/:username/nickname/approve',
    auth,
    requirePermission('nickname:review'),
    ctrl.approveNickname,
  );

  // POST /:username/nickname/reject — 駁回暱稱
  router.post(
    '/:username/nickname/reject',
    auth,
    requirePermission('nickname:review'),
    ctrl.rejectNickname,
  );

  return router;
}
