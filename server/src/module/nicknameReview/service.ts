import { Knex } from 'knex';
import { TNicknameReviewQuery } from '@shared/types/nicknameReview';
import { TPagination } from '../../utils/responseHelper';
import { AppError } from '../../utils/appError';
import { ErrorCode } from '../../utils/errorCodes';

export class NicknameReviewService {
  constructor(private db: Knex) {}

  async list(query: TNicknameReviewQuery) {
    const status = query.status ?? 'pending';
    let qb = this.db('players').where('nickname_review_status', status).whereNull('deleted_at');

    if (query.username) {
      qb = qb.where('username', 'like', `%${query.username}%`);
    }
    if (query.nickname) {
      qb = qb.where('nickname', 'like', `%${query.nickname}%`);
    }
    if (query.applyStartDate) {
      qb = qb.where('nickname_apply_at', '>=', query.applyStartDate);
    }
    if (query.applyEndDate) {
      qb = qb.where('nickname_apply_at', '<=', query.applyEndDate);
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [{ count }] = await qb.clone().count('* as count');
    const data = await qb
      .select(
        'username',
        'nickname',
        'nickname_apply_at',
        'nickname_review_status',
        'nickname_reviewed_by',
        'nickname_reviewed_at',
      )
      .orderBy('nickname_apply_at', 'asc')
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const total = Number(count);
    const pagination: TPagination = {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };

    return { data, pagination };
  }

  async approve(username: string, operator: string) {
    const player = await this.db('players').where({ username }).whereNull('deleted_at').first();

    if (!player) {
      throw new AppError(ErrorCode.PLAYER_NOT_FOUND);
    }
    if (player.nickname_review_status !== 'pending') {
      throw new AppError(ErrorCode.PLAYER_NICKNAME_NOT_PENDING);
    }

    await this.db('players').where({ username }).update({
      nickname_review_status: 'approved',
      nickname_reviewed_by: operator,
      nickname_reviewed_at: this.db.fn.now(),
      updated_at: this.db.fn.now(),
    });
  }

  async reject(username: string, operator: string) {
    const player = await this.db('players').where({ username }).whereNull('deleted_at').first();

    if (!player) {
      throw new AppError(ErrorCode.PLAYER_NOT_FOUND);
    }
    if (player.nickname_review_status !== 'pending') {
      throw new AppError(ErrorCode.PLAYER_NICKNAME_NOT_PENDING);
    }

    await this.db('players').where({ username }).update({
      nickname: username,
      nickname_review_status: 'rejected',
      nickname_reviewed_by: operator,
      nickname_reviewed_at: this.db.fn.now(),
      updated_at: this.db.fn.now(),
    });
  }
}
