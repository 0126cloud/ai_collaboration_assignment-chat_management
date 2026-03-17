import { Knex } from 'knex';
import {
  TBroadcastItem,
  TBroadcastQuery,
  TBroadcastStatus,
  TCreateBroadcastPayload,
} from '@shared/types/broadcast';
import { TPagination } from '../../utils/responseHelper';

export class BroadcastService {
  constructor(private db: Knex) {}

  private computeStatus(startAt: string, duration: number): TBroadcastStatus {
    const now = Date.now();
    const start = new Date(startAt).getTime();
    const end = start + duration * 1000;
    if (now < start) return 'scheduled';
    if (now < end) return 'active';
    return 'expired';
  }

  private toItem(row: Record<string, unknown>): TBroadcastItem {
    return {
      id: row.id as number,
      message: row.message as string,
      chatroom_id: row.chatroom_id as string,
      duration: row.duration as number,
      start_at: row.start_at as string,
      operator: row.operator as string,
      created_at: row.created_at as string,
      status: this.computeStatus(row.start_at as string, row.duration as number),
    };
  }

  async list(query: TBroadcastQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    let qb = this.db('broadcasts').whereNull('deleted_at');

    if (query.chatroom_id) {
      qb = qb.where('chatroom_id', query.chatroom_id);
    }
    if (query.startDate) {
      qb = qb.where('created_at', '>=', query.startDate);
    }
    if (query.endDate) {
      qb = qb.where('created_at', '<=', query.endDate);
    }

    const [{ count }] = await qb.clone().count('* as count');
    const rows = await qb
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    let data: TBroadcastItem[] = rows.map((row: Record<string, unknown>) => this.toItem(row));

    if (query.status) {
      data = data.filter((item) => item.status === query.status);
    }

    const total = Number(count);
    const pagination: TPagination = {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };

    return { data, pagination };
  }

  async create(payload: TCreateBroadcastPayload, operator: string): Promise<TBroadcastItem> {
    const [id] = await this.db('broadcasts').insert({
      message: payload.message,
      chatroom_id: payload.chatroom_id,
      duration: payload.duration,
      start_at: payload.start_at,
      operator,
    });

    const row = await this.db('broadcasts').where({ id }).first();
    return this.toItem(row);
  }

  async remove(id: number): Promise<boolean> {
    const row = await this.db('broadcasts').where({ id }).whereNull('deleted_at').first();
    if (!row) return false;

    await this.db('broadcasts').where({ id }).update({ deleted_at: this.db.fn.now() });
    return true;
  }
}
