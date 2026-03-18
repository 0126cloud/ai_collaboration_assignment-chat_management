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

      res.locals.operationLog = { operationType: 'CREATE_ADMIN' };
      ResponseHelper.success(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.adminService.list({
        page: Number(req.query.page ?? 1),
        pageSize: Number(req.query.pageSize ?? 20),
        username: req.query.username as string | undefined,
        role: req.query.role as string | undefined,
      });

      ResponseHelper.paginated(res, result.data, result.pagination);
    } catch (err) {
      next(err);
    }
  };

  toggle = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const result = await this.adminService.toggle(id, req.user!.id);

      res.locals.operationLog = { operationType: 'TOGGLE_ADMIN' };
      ResponseHelper.success(res, result);
    } catch (err) {
      next(err);
    }
  };

  updateRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const result = await this.adminService.updateRole(id, req.body.role, req.user!.id);

      res.locals.operationLog = { operationType: 'UPDATE_ADMIN_ROLE' };
      ResponseHelper.success(res, result);
    } catch (err) {
      next(err);
    }
  };
}
