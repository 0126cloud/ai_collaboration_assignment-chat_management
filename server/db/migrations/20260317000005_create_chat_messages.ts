import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('chat_messages', (table) => {
    table.increments('id').primary();
    table.string('chatroom_id', 50).notNullable();
    table.string('player_username', 50).notNullable();
    table.string('player_nickname', 50).notNullable();
    table.text('message').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();

    table.index('chatroom_id');
    table.index('player_username');
    table.index('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('chat_messages');
}
