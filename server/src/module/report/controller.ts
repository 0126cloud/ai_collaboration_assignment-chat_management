import { Request, Response, NextFunction } from 'express';
import { ReportService } from './service';
import { ResponseHelper } from '../../utils/responseHelper';
import { AppError } from '../../utils/appError';
import { ErrorCode } from '../../utils/errorCodes';
import { reportQuerySchema } from '@shared/schemas/report';

export class ReportController {
  constructor(private service: ReportService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = reportQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.issues[0]?.message);
      }

      const result = await this.service.list(parsed.data);
      ResponseHelper.paginated(res, result.data, result.pagination);
    } catch (err) {
      next(err);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'id 必須為有效整數');
      }

      const operator = req.user?.username ?? 'unknown';
      await this.service.approve(id, operator);

      res.locals.operationLog = {
        operationType: 'APPROVE_REPORT',
        targetId: id,
      };

      ResponseHelper.success(res, { message: '檢舉已核准，被檢舉玩家已封鎖' });
    } catch (err) {
      next(err);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'id 必須為有效整數');
      }

      const operator = req.user?.username ?? 'unknown';
      await this.service.reject(id, operator);

      res.locals.operationLog = {
        operationType: 'REJECT_REPORT',
        targetId: id,
      };

      ResponseHelper.success(res, { message: '檢舉已駁回' });
    } catch (err) {
      next(err);
    }
  };
}
