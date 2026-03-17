import { Knex } from 'knex';
import { TPagination } from '../../utils/responseHelper';
import { AppError } from '../../utils/appError';
import { ErrorCode } from '../../utils/errorCodes';

interface IChatMessageQuery {
  page: number;
  pageSize: number;
  chatroomId?: string;
  playerUsername?: string;
  playerNickname?: string;
  message?: string;
  startDate?: string;
  endDate?: string;
}

export class ChatMessageService {
  constructor(private db: Knex) {}

  async list(query: IChatMessageQuery) {
    let qb = this.db('chat_messages').whereNull('deleted_at');

    if (query.chatroomId) {
      qb = qb.where('chatroom_id', query.chatroomId);
    }
    if (query.playerUsername) {
      qb = qb.where('player_username', query.playerUsername);
    }
    if (query.playerNickname) {
      qb = qb.where('player_nickname', 'like', `%${query.playerNickname}%`);
    }
    if (query.message) {
      qb = qb.where('message', 'like', `%${query.message}%`);
    }
    if (query.startDate) {
      qb = qb.where('created_at', '>=', query.startDate);
    }
    if (query.endDate) {
      qb = qb.where('created_at', '<=', query.endDate);
    }

    // 計算 total
    const [{ count }] = await qb.clone().count('* as count');

    // 查詢分頁資料（最新的在前）
    const data = await qb
      .select('id', 'chatroom_id', 'player_username', 'player_nickname', 'message', 'created_at')
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

  async remove(id: number) {
    const updated = await this.db('chat_messages')
      .where('id', id)
      .whereNull('deleted_at')
      .update({ deleted_at: this.db.fn.now() });

    if (updated === 0) {
      throw new AppError(ErrorCode.CHAT_MESSAGE_NOT_FOUND);
    }
  }
}
