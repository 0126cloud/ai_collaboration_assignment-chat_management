import { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../../utils/appError';
import { ErrorCode } from '../../utils/errorCodes';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const JWT_EXPIRES_IN = '4h';

export class AuthService {
  constructor(private db: Knex) {}

  async login(username: string, password: string) {
    const admin = await this.db('admins').where({ username }).first();

    if (!admin) {
      throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
    if (!isPasswordValid) {
      throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    if (!admin.is_active) {
      throw new AppError(ErrorCode.AUTH_ACCOUNT_DISABLED);
    }

    const tokenPayload = {
      id: admin.id,
      username: admin.username,
      role: admin.role,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    return {
      token,
      user: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
      },
    };
  }

  async changePassword(userId: number, oldPassword: string, newPassword: string) {
    const admin = await this.db('admins').where({ id: userId }).first();

    if (!admin) {
      throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, admin.password_hash);
    if (!isOldPasswordValid) {
      throw new AppError(ErrorCode.AUTH_OLD_PASSWORD_INCORRECT);
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await this.db('admins').where({ id: userId }).update({
      password_hash: newHash,
      updated_at: this.db.fn.now(),
    });

    return { message: '密碼更新成功' };
  }
}
