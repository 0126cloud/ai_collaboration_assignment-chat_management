import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/appError';
import { ErrorCode } from '../utils/errorCodes';

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstError = result.error.issues[0];
      throw new AppError(ErrorCode.VALIDATION_ERROR, firstError?.message);
    }
    req.body = result.data;
    next();
  };
}
