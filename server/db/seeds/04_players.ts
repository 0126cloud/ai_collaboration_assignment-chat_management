import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('players').del();

  await knex('players').insert([
    { username: 'player001', nickname: 'LuckyBoy', nickname_approved: true },
    { username: 'player002', nickname: 'BigWinner', nickname_approved: true },
    { username: 'player003', nickname: 'CardMaster', nickname_approved: true },
    { username: 'player004', nickname: 'GoldenHand', nickname_approved: true },
    { username: 'player005', nickname: 'StarPlayer', nickname_approved: true },
    { username: 'player006', nickname: 'DragonKing', nickname_approved: true },
    { username: 'player007', nickname: 'AceHunter', nickname_approved: true },
    { username: 'player008', nickname: 'JackpotJoy', nickname_approved: true },
    { username: 'player009', nickname: 'RoyalFlush', nickname_approved: true },
    { username: 'player010', nickname: 'SpinMaster', nickname_approved: true },
    { username: 'player011', nickname: 'BetKing', nickname_approved: true },
    { username: 'player012', nickname: 'ChipLeader', nickname_approved: true },
    { username: 'player013', nickname: 'HighRoller', nickname_approved: true },
    { username: 'player014', nickname: 'CoolGamer', nickname_approved: true },
    { username: 'player015', nickname: 'WildCard', nickname_approved: true },
    {
      username: 'player016',
      nickname: 'PendingNick1',
      nickname_approved: false,
    },
    {
      username: 'player017',
      nickname: 'PendingNick2',
      nickname_approved: false,
    },
    {
      username: 'player018',
      nickname: 'PendingNick3',
      nickname_approved: false,
    },
  ]);
}
