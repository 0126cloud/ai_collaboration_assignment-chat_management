import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('broadcasts', (table) => {
    table.increments('id').primary();
    table.text('message').notNullable();
    table.string('chatroom_id', 50).notNullable();
    table.integer('duration').notNullable();
    table.datetime('start_at').notNullable();
    table.string('operator', 50).notNullable();
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('deleted_at').nullable();

    table.index('chatroom_id');
    table.index('start_at');
    table.index('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('broadcasts');
}
