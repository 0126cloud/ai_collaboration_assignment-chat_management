import { Router } from 'express';
import { Knex } from 'knex';
import { auth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permission';
import { validate } from '../../middleware/validate';
import { createPlayerBlockSchema, createIpBlockSchema } from '@shared/schemas/blacklist';
import { BlacklistService } from './service';
import { BlacklistController } from './controller';

export function createBlacklistRoutes(db: Knex): Router {
  const router = Router();
  const service = new BlacklistService(db);
  const controller = new BlacklistController(service);

  // Player blacklist routes
  router.get('/player', auth, requirePermission('blacklist:read'), controller.list);
  router.post(
    '/player',
    auth,
    requirePermission('blacklist:create'),
    validate(createPlayerBlockSchema),
    controller.create,
  );
  router.delete('/player/:id', auth, requirePermission('blacklist:delete'), controller.remove);

  // IP block routes
  router.get('/ip', auth, requirePermission('ip_block:read'), controller.list);
  router.post(
    '/ip',
    auth,
    requirePermission('ip_block:create'),
    validate(createIpBlockSchema),
    controller.create,
  );
  router.delete('/ip/:id', auth, requirePermission('ip_block:delete'), controller.remove);

  return router;
}
