import { Knex } from 'knex';
import { TReportQuery } from '@shared/types/report';
import { TPagination } from '../../utils/responseHelper';
import { AppError } from '../../utils/appError';
import { ErrorCode } from '../../utils/errorCodes';
import { BlacklistService } from '../blacklist/service';

export class ReportService {
  constructor(
    private db: Knex,
    private blacklistService: BlacklistService,
  ) {}

  async list(query: TReportQuery) {
    const status = query.status ?? 'pending';
    let qb = this.db('reports').where('status', status);

    if (query.reporterUsername) {
      qb = qb.where('reporter_username', 'like', `%${query.reporterUsername}%`);
    }
    if (query.targetUsername) {
      qb = qb.where('target_username', 'like', `%${query.targetUsername}%`);
    }
    if (query.startDate) {
      qb = qb.where('created_at', '>=', query.startDate);
    }
    if (query.endDate) {
      qb = qb.where('created_at', '<=', query.endDate);
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [{ count }] = await qb.clone().count('* as count');
    const data = await qb
      .select('*')
      .orderBy('created_at', 'desc')
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

  async approve(id: number, operator: string) {
    await this.db.transaction(async (trx) => {
      const report = await trx('reports').where({ id }).first();
      if (!report) {
        throw new AppError(ErrorCode.REPORT_NOT_FOUND);
      }
      if (report.status !== 'pending') {
        throw new AppError(ErrorCode.REPORT_ALREADY_REVIEWED);
      }

      await trx('reports').where({ id }).update({
        status: 'approved',
        reviewed_by: operator,
        reviewed_at: trx.fn.now(),
      });

      // 使用 trx 建立 BlacklistService，確保在同一 transaction 內執行
      const trxBlacklistService = new BlacklistService(trx);
      try {
        await trxBlacklistService.create(
          'player',
          {
            target: report.target_username,
            reason: report.reason,
            chatroom_id: report.chatroom_id,
          },
          operator,
        );
      } catch (err) {
        if (err instanceof AppError && err.code === ErrorCode.BLACKLIST_ALREADY_BLOCKED) {
          // 目標已封鎖，靜默忽略
          return;
        }
        throw err;
      }
    });
  }

  async reject(id: number, operator: string) {
    const report = await this.db('reports').where({ id }).first();
    if (!report) {
      throw new AppError(ErrorCode.REPORT_NOT_FOUND);
    }
    if (report.status !== 'pending') {
      throw new AppError(ErrorCode.REPORT_ALREADY_REVIEWED);
    }

    await this.db('reports').where({ id }).update({
      status: 'rejected',
      reviewed_by: operator,
      reviewed_at: this.db.fn.now(),
    });
  }
}
