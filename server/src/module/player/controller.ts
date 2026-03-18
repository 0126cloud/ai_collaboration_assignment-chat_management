import { Request, Response, NextFunction } from 'express';
import { PlayerService } from './service';
import { ResponseHelper } from '../../utils/responseHelper';
import { AppError } from '../../utils/appError';
import { ErrorCode } from '../../utils/errorCodes';
import { nicknameReviewQuerySchema } from '@shared/schemas/nicknameReview';

export class PlayerController {
  constructor(private playerService: PlayerService) {}

  resetNickname = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username } = req.params;
      await this.playerService.resetNickname(String(username));

      res.locals.operationLog = { operationType: 'RESET_NICKNAME' };
      ResponseHelper.success(res, { message: '暱稱已重設', username });
    } catch (err) {
      next(err);
    }
  };

  listNicknameReviews = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = nicknameReviewQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.issues[0]?.message);
      }

      const result = await this.playerService.listNicknameReviews(parsed.data);
      ResponseHelper.paginated(res, result.data, result.pagination);
    } catch (err) {
      next(err);
    }
  };

  approveNickname = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const username = String(req.params.username);
      await this.playerService.approveNickname(username, req.user!.username);

      res.locals.operationLog = {
        operationType: 'APPROVE_NICKNAME',
        targetId: username,
      };

      ResponseHelper.success(res, { message: '暱稱申請已核准' });
    } catch (err) {
      next(err);
    }
  };

  rejectNickname = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const username = String(req.params.username);
      await this.playerService.rejectNickname(username, req.user!.username);

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
