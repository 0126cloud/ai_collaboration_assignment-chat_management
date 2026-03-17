import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('blacklist').del();

  await knex('blacklist').insert([
    // 玩家黑名單（5 筆）
    {
      block_type: 'player',
      target: 'player03',
      reason: 'spam',
      operator: 'admin01',
      chatroom_id: 'baccarat_001',
      is_blocked: true,
    },
    {
      block_type: 'player',
      target: 'player07',
      reason: 'abuse',
      operator: 'admin01',
      chatroom_id: '*',
      is_blocked: true,
    },
    {
      block_type: 'player',
      target: 'player10',
      reason: 'advertisement',
      operator: 'admin02',
      chatroom_id: 'blackjack_001',
      is_blocked: true,
    },
    {
      block_type: 'player',
      target: 'player12',
      reason: 'spam',
      operator: 'admin02',
      chatroom_id: 'roulette_001',
      is_blocked: true,
    },
    {
      block_type: 'player',
      target: 'player15',
      reason: 'abuse',
      operator: 'admin01',
      chatroom_id: '*',
      is_blocked: true,
    },
    // IP 封鎖（3 筆）
    {
      block_type: 'ip',
      target: '116.62.238.199',
      reason: 'spam',
      operator: 'admin01',
      chatroom_id: '*',
      is_blocked: true,
    },
    {
      block_type: 'ip',
      target: '116.62.238.*',
      reason: 'abuse',
      operator: 'admin02',
      chatroom_id: '*',
      is_blocked: true,
    },
    {
      block_type: 'ip',
      target: '192.168.1.100',
      reason: 'spam',
      operator: 'admin01',
      chatroom_id: 'baccarat_001',
      is_blocked: true,
    },
  ]);
}
