import { Request, Response, NextFunction } from 'express';
import { PlayerService } from './service';
import { ResponseHelper } from '../../utils/responseHelper';

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
}
