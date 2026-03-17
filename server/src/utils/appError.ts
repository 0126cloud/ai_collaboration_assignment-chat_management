import { ErrorCode, ERROR_MESSAGES } from './errorCodes';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;

  constructor(code: ErrorCode, customMessage?: string) {
    const config = ERROR_MESSAGES[code];
    super(customMessage || config.message);
    this.code = code;
    this.statusCode = config.statusCode;
  }
}
