import { Router } from 'express';
import { Knex } from 'knex';
import { auth } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permission';
import { ChatroomService } from './service';
import { ChatroomController } from './controller';

export function createChatroomRoutes(db: Knex): Router {
  const router = Router();
  const service = new ChatroomService(db);
  const ctrl = new ChatroomController(service);

  // GET / — 查詢聊天室列表
  router.get('/', auth, requirePermission('chatroom:read'), ctrl.list);

  return router;
}
