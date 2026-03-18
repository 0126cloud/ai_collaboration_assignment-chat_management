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
    let qb = this.db('chat_messages')
      .join('players', 'chat_messages.player_username', 'players.username')
      .whereNull('chat_messages.deleted_at');

    if (query.chatroomId) {
      qb = qb.where('chat_messages.chatroom_id', query.chatroomId);
    }
    if (query.playerUsername) {
      qb = qb.where('chat_messages.player_username', query.playerUsername);
    }
    if (query.playerNickname) {
      qb = qb.where('players.nickname', 'like', `%${query.playerNickname}%`);
    }
    if (query.message) {
      qb = qb.where('chat_messages.message', 'like', `%${query.message}%`);
    }
    if (query.startDate) {
      qb = qb.where('chat_messages.created_at', '>=', query.startDate);
    }
    if (query.endDate) {
      qb = qb.where('chat_messages.created_at', '<=', query.endDate);
    }

    // 計算 total
    const [{ count }] = await qb.clone().count('* as count');

    // 查詢分頁資料（最新的在前）
    const maxRecords = Number(process.env.MAX_CHATTING_RECORD_NUM ?? 200);
    const effectivePageSize = Math.min(query.pageSize, maxRecords);
    const data = await qb
      .select(
        'chat_messages.id',
        'chat_messages.chatroom_id',
        'chat_messages.player_username',
        'players.nickname as player_nickname',
        'chat_messages.message',
        'chat_messages.created_at',
      )
      .orderBy('chat_messages.created_at', 'desc')
      .limit(effectivePageSize)
      .offset((query.page - 1) * effectivePageSize);

    const total = Number(count);
    const pagination: TPagination = {
      page: query.page,
      pageSize: effectivePageSize,
      total,
      totalPages: Math.ceil(total / effectivePageSize),
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
