import { Router } from 'express';
import { Knex } from 'knex';
import { auth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permission';
import { BroadcastService } from './service';
import { BroadcastController } from './controller';

export function createBroadcastRoutes(db: Knex): Router {
  const router = Router();
  const service = new BroadcastService(db);
  const controller = new BroadcastController(service);

  router.get('/', auth, requirePermission('broadcast:read'), controller.list);
  router.post('/', auth, requirePermission('broadcast:create'), controller.create);
  router.delete('/:id', auth, requirePermission('broadcast:delete'), controller.remove);

  return router;
}
