import type { Knex } from 'knex';

// 統一全域封鎖的 chatroom_id magic value：'*' → 'all'
// 目的：與 broadcasts 表的 chatroom_id='all' 保持一致
export async function up(knex: Knex): Promise<void> {
  await knex('blacklist').where('chatroom_id', '*').update({ chatroom_id: 'all' });

  await knex.schema.alterTable('blacklist', (table) => {
    table.string('chatroom_id', 50).notNullable().defaultTo('all').alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex('blacklist').where('chatroom_id', 'all').update({ chatroom_id: '*' });

  await knex.schema.alterTable('blacklist', (table) => {
    table.string('chatroom_id', 50).notNullable().defaultTo('*').alter();
  });
}
