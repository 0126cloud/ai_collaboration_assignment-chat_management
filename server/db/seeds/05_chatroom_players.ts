import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('chatroom_players').del();

  const assignments = [
    // baccarat_001: 8 位玩家
    ...[
      'player001',
      'player002',
      'player003',
      'player004',
      'player005',
      'player006',
      'player007',
      'player008',
    ].map((p) => ({ chatroom_id: 'baccarat_001', player_username: p })),
    // baccarat_002: 6 位玩家
    ...['player003', 'player004', 'player009', 'player010', 'player011', 'player012'].map((p) => ({
      chatroom_id: 'baccarat_002',
      player_username: p,
    })),
    // blackjack_001: 7 位玩家
    ...[
      'player001',
      'player005',
      'player006',
      'player010',
      'player013',
      'player014',
      'player015',
    ].map((p) => ({
      chatroom_id: 'blackjack_001',
      player_username: p,
    })),
    // roulette_001: 5 位玩家
    ...['player002', 'player007', 'player011', 'player016', 'player017'].map((p) => ({
      chatroom_id: 'roulette_001',
      player_username: p,
    })),
    // slots_001: 6 位玩家
    ...['player008', 'player009', 'player012', 'player013', 'player015', 'player018'].map((p) => ({
      chatroom_id: 'slots_001',
      player_username: p,
    })),
  ];

  await knex('chatroom_players').insert(assignments);
}
