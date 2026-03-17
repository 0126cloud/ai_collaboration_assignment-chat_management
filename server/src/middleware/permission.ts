import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError';
import { ErrorCode } from '../utils/errorCodes';
import { getPermissionsForRole } from '../config/permissions';

export function requirePermission(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const userRole = req.user?.role || '';
    const userPerms = getPermissionsForRole(userRole);
    const hasAll = requiredPermissions.every((p) => userPerms.includes(p));

    if (!hasAll) {
      throw new AppError(ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS);
    }

    next();
  };
}
