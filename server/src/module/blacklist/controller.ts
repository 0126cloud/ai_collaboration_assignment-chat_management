import { Request, Response, NextFunction } from 'express';
import { BlacklistService } from './service';
import { ResponseHelper } from '../../utils/responseHelper';
import { blacklistQuerySchema } from '@shared/schemas/blacklist';
import { AppError } from '../../utils/appError';
import { ErrorCode } from '../../utils/errorCodes';

export class BlacklistController {
  constructor(private service: BlacklistService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const blockType = req.path.includes('/ip') ? 'ip' : 'player';

      const parsed = blacklistQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.issues[0]?.message);
      }

      const query = parsed.data;
      const result = await this.service.list(blockType, {
        page: query.page,
        pageSize: query.pageSize,
        target: query.target,
        reason: query.reason,
        chatroomId: query.chatroomId,
        startDate: query.startDate,
        endDate: query.endDate,
        status: query.status,
      });

      ResponseHelper.paginated(res, result.data, result.pagination);
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const blockType = req.path.includes('/ip') ? 'ip' : 'player';
      const operator = req.user?.username ?? 'unknown';

      const result = await this.service.create(blockType, req.body, operator);

      res.locals.operationLog = {
        operationType: blockType === 'ip' ? 'BLOCK_IP' : 'BLOCK_PLAYER',
      };

      ResponseHelper.success(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const blockType = req.path.includes('/ip') ? 'ip' : 'player';
      const id = Number(req.params.id);

      await this.service.remove(blockType, id);

      res.locals.operationLog = {
        operationType: blockType === 'ip' ? 'UNBLOCK_IP' : 'UNBLOCK_PLAYER',
      };

      ResponseHelper.success(res, { message: '已成功解封' });
    } catch (err) {
      next(err);
    }
  };
}
