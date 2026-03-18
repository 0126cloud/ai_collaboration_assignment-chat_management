import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('chat_messages').del();

  const now = new Date();
  const messages = [
    // baccarat_001 — 15 筆
    msg('baccarat_001', 'player001', '大家好！今天手氣不錯', hoursAgo(now, 2)),
    msg('baccarat_001', 'player002', '莊家連開三把了', hoursAgo(now, 3)),
    msg('baccarat_001', 'player003', '我押閒家 500', hoursAgo(now, 5)),
    msg('baccarat_001', 'player004', '恭喜 LuckyBoy 贏了！', hoursAgo(now, 6)),
    msg('baccarat_001', 'player005', '這局好刺激', hoursAgo(now, 8)),
    msg('baccarat_001', 'player001', '謝謝！繼續加油', hoursAgo(now, 10)),
    msg('baccarat_001', 'player006', '今天百家樂好熱鬧', hoursAgo(now, 24)),
    msg('baccarat_001', 'player007', '龍寶開了嗎？', hoursAgo(now, 26)),
    msg('baccarat_001', 'player002', '剛剛開了一把龍寶', hoursAgo(now, 30)),
    msg('baccarat_001', 'player008', '這桌勝率不錯', hoursAgo(now, 48)),
    msg('baccarat_001', 'player003', '大家晚安', hoursAgo(now, 50)),
    msg('baccarat_001', 'player004', '明天見！', hoursAgo(now, 52)),
    msg('baccarat_001', 'player005', '最後一把了', hoursAgo(now, 72)),
    msg('baccarat_001', 'player001', '祝大家好運', hoursAgo(now, 96)),
    msg('baccarat_001', 'player006', '週末來玩', hoursAgo(now, 120)),

    // baccarat_002 — 12 筆
    msg('baccarat_002', 'player003', '二號房人比較少', hoursAgo(now, 1)),
    msg('baccarat_002', 'player004', '這邊比較好下注', hoursAgo(now, 4)),
    msg('baccarat_002', 'player009', '剛轉過來', hoursAgo(now, 7)),
    msg('baccarat_002', 'player010', '這邊賠率不錯', hoursAgo(now, 12)),
    msg('baccarat_002', 'player011', '押莊 1000', hoursAgo(now, 15)),
    msg('baccarat_002', 'player012', '恭喜 BetKing！', hoursAgo(now, 18)),
    msg('baccarat_002', 'player003', '連贏兩把', hoursAgo(now, 36)),
    msg('baccarat_002', 'player009', '手氣真好', hoursAgo(now, 40)),
    msg('baccarat_002', 'player010', '今天到此為止', hoursAgo(now, 60)),
    msg('baccarat_002', 'player011', '明天再來', hoursAgo(now, 84)),
    msg('baccarat_002', 'player004', '晚安大家', hoursAgo(now, 100)),
    msg('baccarat_002', 'player012', '好夢', hoursAgo(now, 130)),

    // blackjack_001 — 15 筆
    msg('blackjack_001', 'player001', '21 點開桌了', hoursAgo(now, 1)),
    msg('blackjack_001', 'player005', '要牌！', hoursAgo(now, 3)),
    msg('blackjack_001', 'player006', '停牌', hoursAgo(now, 5)),
    msg('blackjack_001', 'player010', '爆了...', hoursAgo(now, 9)),
    msg('blackjack_001', 'player013', 'Blackjack！', hoursAgo(now, 11)),
    msg('blackjack_001', 'player014', '厲害！恭喜', hoursAgo(now, 14)),
    msg('blackjack_001', 'player015', '我也要試試', hoursAgo(now, 20)),
    msg('blackjack_001', 'player001', '加倍下注', hoursAgo(now, 22)),
    msg('blackjack_001', 'player005', '好緊張', hoursAgo(now, 28)),
    msg('blackjack_001', 'player013', '又贏了！', hoursAgo(now, 35)),
    msg('blackjack_001', 'player006', '手氣真好', hoursAgo(now, 45)),
    msg('blackjack_001', 'player014', '分牌吧', hoursAgo(now, 55)),
    msg('blackjack_001', 'player015', '差一點就 21', hoursAgo(now, 70)),
    msg('blackjack_001', 'player010', '下次再來', hoursAgo(now, 90)),
    msg('blackjack_001', 'player001', '感謝各位', hoursAgo(now, 110)),

    // roulette_001 — 10 筆
    msg('roulette_001', 'player002', '紅色 23！', hoursAgo(now, 2)),
    msg('roulette_001', 'player007', '我押黑色', hoursAgo(now, 6)),
    msg('roulette_001', 'player011', '單數全押', hoursAgo(now, 10)),
    msg('roulette_001', 'player016', '第一次玩輪盤', hoursAgo(now, 16)),
    msg('roulette_001', 'player017', '開了幾號？', hoursAgo(now, 20)),
    msg('roulette_001', 'player002', '開 17 黑色', hoursAgo(now, 32)),
    msg('roulette_001', 'player007', '贏了！', hoursAgo(now, 44)),
    msg('roulette_001', 'player011', '下一把押偶數', hoursAgo(now, 65)),
    msg('roulette_001', 'player016', '好玩', hoursAgo(now, 80)),
    msg('roulette_001', 'player017', '改天再來', hoursAgo(now, 140)),

    // slots_001 — 12 筆
    msg('slots_001', 'player008', '老虎機轉起來！', hoursAgo(now, 1)),
    msg('slots_001', 'player009', '三個七！', hoursAgo(now, 4)),
    msg('slots_001', 'player012', '恭喜中大獎！', hoursAgo(now, 8)),
    msg('slots_001', 'player013', '我也要試試運氣', hoursAgo(now, 13)),
    msg('slots_001', 'player015', '這台中獎率好像不錯', hoursAgo(now, 19)),
    msg('slots_001', 'player018', '新手報到', hoursAgo(now, 25)),
    msg('slots_001', 'player008', '免費轉開了！', hoursAgo(now, 38)),
    msg('slots_001', 'player009', '好多 scatter', hoursAgo(now, 50)),
    msg('slots_001', 'player012', '繼續轉', hoursAgo(now, 68)),
    msg('slots_001', 'player013', '差一個就三連線', hoursAgo(now, 88)),
    msg('slots_001', 'player015', '今天收穫不少', hoursAgo(now, 115)),
    msg('slots_001', 'player018', '好刺激', hoursAgo(now, 145)),
  ];

  // 標記 3 筆為已刪除
  messages[10].deleted_at = hoursAgo(now, 49); // baccarat_001 'CardMaster' '大家晚安'
  messages[30].deleted_at = hoursAgo(now, 54); // blackjack_001 'CoolGamer' '分牌吧'
  messages[50].deleted_at = hoursAgo(now, 37); // slots_001 'JackpotJoy' '免費轉開了！'

  await knex('chat_messages').insert(messages);
}

function msg(
  chatroomId: string,
  playerUsername: string,
  message: string,
  createdAt: string,
): {
  chatroom_id: string;
  player_username: string;
  message: string;
  created_at: string;
  deleted_at?: string;
} {
  return {
    chatroom_id: chatroomId,
    player_username: playerUsername,
    message,
    created_at: createdAt,
  };
}

function hoursAgo(base: Date, hours: number): string {
  const d = new Date(base);
  d.setHours(d.getHours() - hours);
  return d.toISOString().replace('T', ' ').substring(0, 19);
}
