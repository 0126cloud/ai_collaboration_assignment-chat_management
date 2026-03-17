import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('blacklist', (table) => {
    table.boolean('is_blocked').notNullable().defaultTo(true);
  });

  // 將現有資料的 deleted_at 轉換：deleted_at IS NULL → is_blocked=true, deleted_at IS NOT NULL → is_blocked=false
  await knex('blacklist').whereNull('deleted_at').update({ is_blocked: true });
  await knex('blacklist').whereNotNull('deleted_at').update({ is_blocked: false });

  await knex.schema.alterTable('blacklist', (table) => {
    table.dropColumn('deleted_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('blacklist', (table) => {
    table.timestamp('deleted_at').nullable();
  });

  // 回復：is_blocked=false → deleted_at=now(), is_blocked=true → deleted_at=null
  await knex('blacklist').where('is_blocked', false).update({ deleted_at: knex.fn.now() });

  await knex.schema.alterTable('blacklist', (table) => {
    table.dropColumn('is_blocked');
  });
}
