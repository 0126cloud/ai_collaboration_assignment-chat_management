import { Request, Response, NextFunction } from 'express';
import { AuthService } from './service';
import { ResponseHelper } from '../../utils/responseHelper';
import { getPermissionsForRole } from '../../config/permissions';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 4 * 60 * 60 * 1000,
};

export class AuthController {
  constructor(private authService: AuthService) {}

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, password } = req.body;
      const result = await this.authService.login(username, password);
      res.cookie('token', result.token, COOKIE_OPTIONS);
      ResponseHelper.success(res, result);
    } catch (err) {
      next(err);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { oldPassword, newPassword } = req.body;
      const result = await this.authService.changePassword(userId, oldPassword, newPassword);
      ResponseHelper.success(res, result);
    } catch (err) {
      next(err);
    }
  };

  getPermissions = (req: Request, res: Response) => {
    const role = req.user!.role;
    const permissions = getPermissionsForRole(role);
    ResponseHelper.success(res, { role, permissions });
  };

  me = (req: Request, res: Response) => {
    const { id, username, role } = req.user!;
    const permissions = getPermissionsForRole(role);
    ResponseHelper.success(res, { user: { id, username, role }, permissions });
  };

  logout = (_req: Request, res: Response) => {
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'strict' as const,
      path: '/',
    });
    ResponseHelper.success(res, { message: '登出成功' });
  };
}
