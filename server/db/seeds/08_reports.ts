import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('reports').del();

  await knex('reports').insert([
    {
      reporter_username: 'player001',
      target_username: 'player003',
      chatroom_id: 'baccarat_001',
      chat_message_id: null,
      chat_message: '你這個混蛋！你根本不會玩！',
      reason: 'abuse',
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
    },
    {
      reporter_username: 'player002',
      target_username: 'player007',
      chatroom_id: 'blackjack_001',
      chat_message_id: null,
      chat_message: '免費送錢，加我微信 xxx123，限時優惠！',
      reason: 'spam',
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
    },
    {
      reporter_username: 'player004',
      target_username: 'player010',
      chatroom_id: 'roulette_001',
      chat_message_id: null,
      chat_message: '全場最低手續費，點擊連結立即加入！',
      reason: 'advertisement',
      status: 'approved',
      reviewed_by: 'admin01',
      reviewed_at: '2026-03-16 10:00:00',
    },
    {
      reporter_username: 'player005',
      target_username: 'player012',
      chatroom_id: 'baccarat_001',
      chat_message_id: null,
      chat_message: '垃圾訊息，騙人的！',
      reason: 'spam',
      status: 'rejected',
      reviewed_by: 'admin02',
      reviewed_at: '2026-03-16 11:00:00',
    },
    {
      reporter_username: 'player006',
      target_username: 'player015',
      chatroom_id: 'blackjack_001',
      chat_message_id: null,
      chat_message: '一直罵人，語言很不友善',
      reason: 'abuse',
      status: 'approved',
      reviewed_by: 'admin01',
      reviewed_at: '2026-03-16 12:00:00',
    },
  ]);
}
