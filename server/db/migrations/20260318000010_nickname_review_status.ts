import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. 新增三個新欄位
  await knex.schema.alterTable('players', (table) => {
    table.string('nickname_review_status', 20).nullable();
    table.string('nickname_reviewed_by', 50).nullable();
    table.datetime('nickname_reviewed_at').nullable();
  });

  // 2. 資料遷移
  // 只有待審核玩家（nickname_approved=false + nickname_apply_at 有值）才設為 'pending'；其餘玩家為預設狀態（null）
  await knex('players')
    .whereRaw('nickname_approved = ? AND nickname_apply_at IS NOT NULL', [false])
    .update({ nickname_review_status: 'pending' });

  // 3. 移除 nickname_approved 欄位
  await knex.schema.alterTable('players', (table) => {
    table.dropColumn('nickname_approved');
  });
}

export async function down(knex: Knex): Promise<void> {
  // 1. 新增回 nickname_approved
  await knex.schema.alterTable('players', (table) => {
    table.boolean('nickname_approved').notNullable().defaultTo(true);
  });

  // 2. 資料回遷
  // 只還原 pending 狀態；approved/rejected 的玩家 rollback 後為 nickname_approved=true（已核准，正確行為）
  await knex('players')
    .where('nickname_review_status', 'pending')
    .update({ nickname_approved: false });

  // 3. 移除三個新欄位
  await knex.schema.alterTable('players', (table) => {
    table.dropColumn('nickname_review_status');
    table.dropColumn('nickname_reviewed_by');
    table.dropColumn('nickname_reviewed_at');
  });
}
