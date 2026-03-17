import { Request, Response, NextFunction } from 'express';
import { OperationLogService } from './service';
import { ResponseHelper } from '../../utils/responseHelper';
import { operationLogQuerySchema } from '@shared/schemas/operationLog';
import { AppError } from '../../utils/appError';
import { ErrorCode } from '../../utils/errorCodes';

export class OperationLogController {
  constructor(private operationLogService: OperationLogService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = operationLogQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.issues[0]?.message);
      }

      const query = parsed.data;
      const result = await this.operationLogService.list({
        page: query.page,
        pageSize: query.pageSize,
        operationType: query.operationType,
        operator: query.operator,
        startDate: query.startDate,
        endDate: query.endDate,
      });

      ResponseHelper.paginated(res, result.data, result.pagination);
    } catch (err) {
      next(err);
    }
  };
}
