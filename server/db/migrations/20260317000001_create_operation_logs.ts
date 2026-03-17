import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('operation_logs', (table) => {
    table.increments('id').primary();
    table.string('operation_type', 50).notNullable();
    table.integer('operator_id').notNullable();
    table.string('operator', 50).notNullable();
    table.text('request').notNullable(); // JSON string: { url, method, payload }
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // 索引
    table.index('operation_type');
    table.index('operator_id');
    table.index('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('operation_logs');
}
