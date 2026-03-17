import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('chatrooms').del();

  await knex('chatrooms').insert([
    {
      id: 'baccarat_001',
      name: 'Baccarat Room 1',
      online_user_count: 120,
    },
    {
      id: 'baccarat_002',
      name: 'Baccarat Room 2',
      online_user_count: 85,
    },
    {
      id: 'blackjack_001',
      name: 'Blackjack Room 1',
      online_user_count: 64,
    },
    {
      id: 'roulette_001',
      name: 'Roulette Room 1',
      online_user_count: 45,
    },
    {
      id: 'slots_001',
      name: 'Slots Room 1',
      online_user_count: 200,
    },
  ]);
}
