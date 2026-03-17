import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('reports', (table) => {
    table.increments('id').primary();
    table.string('reporter_username', 50).notNullable();
    table.string('target_username', 50).notNullable();
    table.string('chatroom_id', 50).notNullable();
    table.integer('chat_message_id').nullable();
    table.text('chat_message').notNullable();
    table.string('reason', 20).notNullable();
    table.string('status', 20).notNullable().defaultTo('pending');
    table.string('reviewed_by', 50).nullable();
    table.datetime('reviewed_at').nullable();
    table.datetime('created_at').defaultTo(knex.fn.now());

    table.index('status');
    table.index('reporter_username');
    table.index('target_username');
    table.index('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('reports');
}
