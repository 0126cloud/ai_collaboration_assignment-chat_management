import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('chat_messages', (table) => {
    table.dropColumn('player_nickname');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('chat_messages', (table) => {
    table.string('player_nickname', 50).notNullable().defaultTo('');
  });
}
