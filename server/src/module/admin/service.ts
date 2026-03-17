import { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import { AppError } from '../../utils/appError';
import { ErrorCode } from '../../utils/errorCodes';
import { writeOperationLog } from '../../utils/operationLogModule';

export class AdminService {
  constructor(private db: Knex) {}

  async createAdmin(
    payload: { username: string; password: string; role: string },
    createdBy: { id: number; username: string },
  ) {
    // 檢查 username 是否重複
    const existing = await this.db('admins').where({ username: payload.username }).first();
    if (existing) {
      throw new AppError(ErrorCode.ADMIN_USERNAME_DUPLICATE);
    }

    // bcrypt 雜湊密碼
    const passwordHash = await bcrypt.hash(payload.password, 10);

    // 寫入 DB
    const [id] = await this.db('admins').insert({
      username: payload.username,
      password_hash: passwordHash,
      role: payload.role,
      is_active: true,
      created_by: createdBy.id,
    });

    const newAdmin = await this.db('admins')
      .select('id', 'username', 'role', 'is_active', 'created_at')
      .where({ id })
      .first();

    // 寫入 operation_logs
    await writeOperationLog(this.db, {
      action: 'admin:create',
      operatorId: createdBy.id,
      operatorUsername: createdBy.username,
      target: payload.username,
    });

    return newAdmin;
  }
}
