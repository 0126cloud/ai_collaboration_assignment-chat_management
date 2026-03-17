import { Knex } from 'knex';
import { TPagination } from '../../utils/responseHelper';

interface IChatroomQuery {
  page: number;
  pageSize: number;
  name?: string;
}

export class ChatroomService {
  constructor(private db: Knex) {}

  async list(query: IChatroomQuery) {
    let qb = this.db('chatrooms').whereNull('deleted_at');

    if (query.name) {
      qb = qb.where(function () {
        this.where('name', 'like', `%${query.name}%`).orWhere('id', 'like', `%${query.name}%`);
      });
    }

    // 計算 total
    const [{ count }] = await qb.clone().count('* as count');

    // 查詢分頁資料
    const data = await qb
      .select('id', 'name', 'online_user_count', 'created_at', 'updated_at')
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
}
