import { Request, Response, NextFunction } from 'express';
import { ChatroomService } from './service';
import { ResponseHelper } from '../../utils/responseHelper';
import { chatroomQuerySchema } from '@shared/schemas/chatroom';
import { AppError } from '../../utils/appError';
import { ErrorCode } from '../../utils/errorCodes';

export class ChatroomController {
  constructor(private chatroomService: ChatroomService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = chatroomQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.issues[0]?.message);
      }

      const query = parsed.data;
      const result = await this.chatroomService.list({
        page: query.page,
        pageSize: query.pageSize,
        name: query.name,
      });

      ResponseHelper.paginated(res, result.data, result.pagination);
    } catch (err) {
      next(err);
    }
  };
}
