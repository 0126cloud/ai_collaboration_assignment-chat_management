import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('blacklist', (table) => {
    table.increments('id').primary();
    table.string('block_type', 10).notNullable();
    table.string('target', 100).notNullable();
    table.string('reason', 20).notNullable();
    table.string('operator', 50).notNullable();
    table.string('chatroom_id', 50).notNullable().defaultTo('all');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();

    table.unique(['block_type', 'target', 'chatroom_id']);
    table.index(['block_type', 'target']);
    table.index('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('blacklist');
}
