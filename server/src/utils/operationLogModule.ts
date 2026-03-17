import { Knex } from 'knex';

interface IOperationLogEntry {
  action: string;
  operatorId: number;
  operatorUsername: string;
  target?: string;
  detail?: string;
}

export async function writeOperationLog(db: Knex, entry: IOperationLogEntry): Promise<void> {
  await db('operation_logs').insert({
    action: entry.action,
    operator_id: entry.operatorId,
    operator_username: entry.operatorUsername,
    target: entry.target || null,
    detail: entry.detail || null,
  });
}
