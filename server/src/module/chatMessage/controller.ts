import { Request, Response, NextFunction } from 'express';
import { ChatMessageService } from './service';
import { ResponseHelper } from '../../utils/responseHelper';
import { chatMessageQuerySchema } from '@shared/schemas/chatMessage';
import { AppError } from '../../utils/appError';
import { ErrorCode } from '../../utils/errorCodes';

export class ChatMessageController {
  constructor(private chatMessageService: ChatMessageService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = chatMessageQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, parsed.error.issues[0]?.message);
      }

      const query = parsed.data;

      const maxPageSize = Number(process.env.MAX_CHATTING_RECORD_NUM ?? 200);
      if (query.pageSize > maxPageSize) {
        return res.status(400).json({ error: `pageSize cannot exceed ${maxPageSize}` });
      }

      const result = await this.chatMessageService.list({
        page: query.page,
        pageSize: query.pageSize,
        chatroomId: query.chatroomId,
        playerUsername: query.playerUsername,
        playerNickname: query.playerNickname,
        message: query.message,
        startDate: query.startDate,
        endDate: query.endDate,
      });

      ResponseHelper.paginated(res, result.data, result.pagination);
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      await this.chatMessageService.remove(id);

      // 設定操作紀錄
      res.locals.operationLog = { operationType: 'DELETE_MESSAGE' };

      ResponseHelper.success(res, { message: '訊息已刪除' });
    } catch (err) {
      next(err);
    }
  };
}
