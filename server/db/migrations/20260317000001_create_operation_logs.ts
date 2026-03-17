import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('operation_logs', (table) => {
    table.increments('id').primary();
    table.string('action', 50).notNullable();
    table.integer('operator_id').notNullable();
    table.string('operator_username', 50).notNullable();
    table.string('target', 255).nullable();
    table.text('detail').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('operation_logs');
}
