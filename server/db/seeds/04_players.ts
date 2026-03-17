import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('players').del();

  await knex('players').insert([
    { username: 'player001', nickname: 'LuckyBoy' },
    { username: 'player002', nickname: 'BigWinner' },
    { username: 'player003', nickname: 'CardMaster' },
    { username: 'player004', nickname: 'GoldenHand' },
    { username: 'player005', nickname: 'StarPlayer' },
    { username: 'player006', nickname: 'DragonKing' },
    { username: 'player007', nickname: 'AceHunter' },
    { username: 'player008', nickname: 'JackpotJoy' },
    { username: 'player009', nickname: 'RoyalFlush' },
    { username: 'player010', nickname: 'SpinMaster' },
    { username: 'player011', nickname: 'BetKing' },
    { username: 'player012', nickname: 'ChipLeader' },
    { username: 'player013', nickname: 'HighRoller' },
    { username: 'player014', nickname: 'CoolGamer' },
    { username: 'player015', nickname: 'WildCard' },
    {
      username: 'player016',
      nickname: 'DragonKing',
      nickname_review_status: 'pending',
      nickname_apply_at: '2026-03-15 10:00:00',
    },
    {
      username: 'player017',
      nickname: 'LuckyStrike99',
      nickname_review_status: 'pending',
      nickname_apply_at: '2026-03-15 11:30:00',
    },
    {
      username: 'player018',
      nickname: 'PokerGod777',
      nickname_review_status: 'pending',
      nickname_apply_at: '2026-03-16 09:00:00',
    },
    {
      username: 'player019',
      nickname: 'CasinoMaster',
      nickname_review_status: 'pending',
      nickname_apply_at: '2026-03-16 14:00:00',
    },
    {
      username: 'player020',
      nickname: 'GoldenChip_X',
      nickname_review_status: 'pending',
      nickname_apply_at: '2026-03-17 08:00:00',
    },
  ]);
}
