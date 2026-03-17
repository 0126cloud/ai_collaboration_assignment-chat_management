import { Router } from 'express';
import { Knex } from 'knex';
import { auth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permission';
import { ChatMessageService } from './service';
import { ChatMessageController } from './controller';

export function createChatMessageRoutes(db: Knex): Router {
  const router = Router();
  const service = new ChatMessageService(db);
  const ctrl = new ChatMessageController(service);

  // GET / — 查詢聊天訊息列表
  router.get('/', auth, requirePermission('chat:read'), ctrl.list);

  // DELETE /:id — 軟刪除訊息
  router.delete('/:id', auth, requirePermission('chat:delete'), ctrl.remove);

  return router;
}
