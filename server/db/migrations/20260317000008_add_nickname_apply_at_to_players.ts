import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('players', (table) => {
    table.datetime('nickname_apply_at').nullable().defaultTo(null);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('players', (table) => {
    table.dropColumn('nickname_apply_at');
  });
}
