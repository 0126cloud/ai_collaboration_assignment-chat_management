import { Request, Response, NextFunction } from 'express';
import { AdminService } from './service';
import { ResponseHelper } from '../../utils/responseHelper';

export class AdminController {
  constructor(private adminService: AdminService) {}

  createAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.createAdmin(req.body, {
        id: req.user!.id,
        username: req.user!.username,
      });
      ResponseHelper.success(res, result, 201);
    } catch (err) {
      next(err);
    }
  };
}
