import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('chatroom_players', (table) => {
    table.increments('id').primary();
    table.string('chatroom_id', 50).notNullable();
    table.string('player_username', 50).notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();

    table.unique(['chatroom_id', 'player_username']);
    table.index('chatroom_id');
    table.index('player_username');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('chatroom_players');
}
