import { Request, Response, NextFunction } from 'express';
import { NicknameReviewService } from './service';
import { ResponseHelper } from '../../utils/responseHelper';
import { AppError } from '../../utils/appError';
import { ErrorCode } from '../../utils/errorCodes';
import { nicknameReviewQuerySchema } from '@shared/schemas/nicknameReview';

export class NicknameReviewController {
  constructor(private service: NicknameReviewService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = nicknameReviewQuerySchema.safeParse(req.query);
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
      const username = String(req.params.username);
      await this.service.approve(username, req.user!.username);

      res.locals.operationLog = {
        operationType: 'APPROVE_NICKNAME',
        targetId: username,
      };

      ResponseHelper.success(res, { message: '暱稱申請已核准' });
    } catch (err) {
      next(err);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const username = String(req.params.username);
      await this.service.reject(username, req.user!.username);

      res.locals.operationLog = {
        operationType: 'REJECT_NICKNAME',
        targetId: username,
      };

      ResponseHelper.success(res, { message: '暱稱申請已駁回，暱稱已重設為帳號名稱' });
    } catch (err) {
      next(err);
    }
  };
}
