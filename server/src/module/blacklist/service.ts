import { Knex } from 'knex';
import { TPagination } from '../../utils/responseHelper';
import { AppError } from '../../utils/appError';
import { ErrorCode } from '../../utils/errorCodes';

interface IBlacklistQuery {
  target?: string;
  reason?: string;
  chatroomId?: string;
  startDate?: string;
  endDate?: string;
  status?: 'blocked' | 'unblocked' | 'all';
  page: number;
  pageSize: number;
}

interface ICreatePayload {
  target: string;
  reason: string;
  chatroom_id: string;
}

export class BlacklistService {
  constructor(private db: Knex) {}

  async list(blockType: 'player' | 'ip', query: IBlacklistQuery) {
    let qb = this.db('blacklist').where('block_type', blockType);

    const status = query.status ?? 'blocked';
    if (status === 'blocked') {
      qb = qb.where('is_blocked', true);
    } else if (status === 'unblocked') {
      qb = qb.where('is_blocked', false);
    }
    // 'all' → 不加 is_blocked 篩選

    if (query.target) {
      qb = qb.where('target', 'like', `%${query.target}%`);
    }
    if (query.reason) {
      qb = qb.where('reason', query.reason);
    }
    if (query.chatroomId) {
      qb = qb.where('chatroom_id', 'like', `%${query.chatroomId}%`);
    }
    if (query.startDate) {
      qb = qb.where('created_at', '>=', query.startDate);
    }
    if (query.endDate) {
      qb = qb.where('created_at', '<=', query.endDate);
    }

    const [{ count }] = await qb.clone().count('* as count');

    const data = await qb
      .select(
        'id',
        'block_type',
        'target',
        'reason',
        'operator',
        'chatroom_id',
        'is_blocked',
        'created_at',
      )
      .orderBy('created_at', 'desc')
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);

    const total = Number(count);
    const pagination: TPagination = {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };

    return { data, pagination };
  }

  async create(blockType: 'player' | 'ip', payload: ICreatePayload, operator: string) {
    const { target, reason, chatroom_id } = payload;

    const existing = await this.db('blacklist')
      .where({ block_type: blockType, target, chatroom_id })
      .first();

    if (existing) {
      if (existing.is_blocked) {
        throw new AppError(ErrorCode.BLACKLIST_ALREADY_BLOCKED);
      }
      // 已解封紀錄 → 重新啟用
      await this.db('blacklist').where('id', existing.id).update({ is_blocked: true });
      const updated = await this.db('blacklist').where('id', existing.id).first();
      return updated;
    }

    const [id] = await this.db('blacklist').insert({
      block_type: blockType,
      target,
      reason,
      operator,
      chatroom_id,
      is_blocked: true,
    });
    const created = await this.db('blacklist').where('id', id).first();
    return created;
  }

  async remove(blockType: 'player' | 'ip', id: number) {
    const entry = await this.db('blacklist')
      .where({ id, block_type: blockType, is_blocked: true })
      .first();

    if (!entry) {
      throw new AppError(ErrorCode.BLACKLIST_ENTRY_NOT_FOUND);
    }

    await this.db('blacklist').where('id', id).update({ is_blocked: false });
  }
}
