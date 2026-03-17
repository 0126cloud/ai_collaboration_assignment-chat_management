import { Request, Response, NextFunction } from 'express';
import { BroadcastService } from './service';
import { ResponseHelper } from '../../utils/responseHelper';
import { AppError } from '../../utils/appError';
import { ErrorCode } from '../../utils/errorCodes';
import { broadcastQuerySchema, createBroadcastSchema } from '@shared/schemas/broadcast';

export class BroadcastController {
  constructor(private service: BroadcastService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = broadcastQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.issues[0]?.message);
      }

      const result = await this.service.list(parsed.data);
      ResponseHelper.paginated(res, result.data, result.pagination);
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createBroadcastSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.issues[0]?.message);
      }

      const operator = req.user?.username ?? 'unknown';
      const result = await this.service.create(parsed.data, operator);

      res.locals.operationLog = {
        operationType: 'SEND_BROADCAST',
        targetId: result.id,
      };

      ResponseHelper.success(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'id 必須為有效整數');
      }

      const success = await this.service.remove(id);
      if (!success) {
        throw new AppError(ErrorCode.BROADCAST_NOT_FOUND);
      }

      res.locals.operationLog = {
        operationType: 'DELETE_BROADCAST',
        targetId: id,
      };

      ResponseHelper.success(res, { message: '廣播已下架' });
    } catch (err) {
      next(err);
    }
  };
}
