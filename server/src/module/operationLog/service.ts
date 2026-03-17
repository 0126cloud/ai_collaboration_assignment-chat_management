import { Knex } from 'knex';
import { TPagination } from '../../utils/responseHelper';

interface IOperationLogQuery {
  page: number;
  pageSize: number;
  operationType?: string;
  operator?: string;
  startDate?: string;
  endDate?: string;
}

export class OperationLogService {
  constructor(private db: Knex) {}

  async list(query: IOperationLogQuery) {
    let qb = this.db('operation_logs');

    if (query.operationType) {
      qb = qb.where('operation_type', query.operationType);
    }
    if (query.operator) {
      qb = qb.where('operator', 'like', `%${query.operator}%`);
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
      .orderBy('created_at', 'desc')
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);

    // parse request JSON 字串為物件
    const parsed = data.map((row: { request: string; [key: string]: unknown }) => ({
      ...row,
      request: JSON.parse(row.request as string),
    }));

    const total = Number(count);
    const pagination: TPagination = {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };

    return { data: parsed, pagination };
  }
}
