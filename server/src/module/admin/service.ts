import { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import { AppError } from '../../utils/appError';
import { ErrorCode } from '../../utils/errorCodes';

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

    return newAdmin;
  }

  async list(query: { page: number; pageSize: number; username?: string; role?: string }) {
    const { page, pageSize, username, role } = query;

    let baseQuery = this.db('admins').select('id', 'username', 'role', 'is_active', 'created_at');

    if (username) {
      baseQuery = baseQuery.where('username', 'like', `%${username}%`);
    }
    if (role) {
      baseQuery = baseQuery.where({ role });
    }

    const total = await this.db('admins')
      .modify((q) => {
        if (username) q.where('username', 'like', `%${username}%`);
        if (role) q.where({ role });
      })
      .count('id as count')
      .first()
      .then((r) => Number(r?.count ?? 0));

    const data = await baseQuery
      .orderBy('id', 'asc')
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async toggle(id: number, operatorId: number) {
    if (id === operatorId) {
      throw new AppError(ErrorCode.ADMIN_CANNOT_SELF_MODIFY);
    }

    const admin = await this.db('admins').where({ id }).first();
    if (!admin) {
      throw new AppError(ErrorCode.ADMIN_NOT_FOUND);
    }

    const newIsActive = !admin.is_active;
    await this.db('admins').where({ id }).update({ is_active: newIsActive });

    const updated = await this.db('admins')
      .select('id', 'username', 'role', 'is_active', 'created_at')
      .where({ id })
      .first();

    return updated;
  }

  async updateRole(id: number, role: string, operatorId: number) {
    if (id === operatorId) {
      throw new AppError(ErrorCode.ADMIN_CANNOT_SELF_MODIFY);
    }

    const admin = await this.db('admins').where({ id }).first();
    if (!admin) {
      throw new AppError(ErrorCode.ADMIN_NOT_FOUND);
    }

    await this.db('admins').where({ id }).update({ role });

    const updated = await this.db('admins')
      .select('id', 'username', 'role', 'is_active', 'created_at')
      .where({ id })
      .first();

    return updated;
  }

  async resetPassword(id: number, newPassword: string) {
    const admin = await this.db('admins').where({ id }).first();
    if (!admin) {
      throw new AppError(ErrorCode.ADMIN_NOT_FOUND);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.db('admins').where({ id }).update({ password_hash: passwordHash });
  }
}
