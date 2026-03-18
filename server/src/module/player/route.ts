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

  return router;
}
