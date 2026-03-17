import { Response } from 'express';
import { AppError } from './appError';

export interface TPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export class ResponseHelper {
  static success<T>(res: Response, data: T, statusCode = 200): void {
    res.status(statusCode).json({ success: true, data });
  }

  static paginated<T>(res: Response, data: T[], pagination: TPagination): void {
    res.status(200).json({ success: true, data, pagination });
  }

  static error(res: Response, appError: AppError): void {
    res.status(appError.statusCode).json({
      success: false,
      error: {
        code: appError.code,
        message: appError.message,
      },
    });
  }
}
