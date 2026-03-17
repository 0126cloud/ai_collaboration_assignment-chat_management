import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('broadcasts').del();

  await knex('broadcasts').insert([
    {
      message: 'System maintenance in 10 minutes',
      chatroom_id: 'all',
      duration: 600,
      start_at: '2026-03-18 08:00:00',
      operator: 'admin01',
    },
    {
      message: 'Welcome bonus event is now live!',
      chatroom_id: 'baccarat_001',
      duration: 3600,
      start_at: '2026-03-17 12:00:00',
      operator: 'admin01',
    },
    {
      message: 'Server update completed successfully',
      chatroom_id: 'all',
      duration: 300,
      start_at: '2026-03-16 00:00:00',
      operator: 'admin01',
    },
  ]);
}
