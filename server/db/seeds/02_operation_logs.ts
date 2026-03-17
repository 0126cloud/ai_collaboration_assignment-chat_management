import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('operation_logs').del();

  const now = new Date();
  const records = [
    // CREATE_ADMIN × 3
    {
      operation_type: 'CREATE_ADMIN',
      operator_id: 1,
      operator: 'admin01',
      request: JSON.stringify({
        url: '/api/admins',
        method: 'POST',
        payload: { username: 'admin04', role: 'general_manager' },
      }),
      created_at: daysAgo(now, 1),
    },
    {
      operation_type: 'CREATE_ADMIN',
      operator_id: 1,
      operator: 'admin01',
      request: JSON.stringify({
        url: '/api/admins',
        method: 'POST',
        payload: { username: 'admin05', role: 'general_manager' },
      }),
      created_at: daysAgo(now, 5),
    },
    {
      operation_type: 'CREATE_ADMIN',
      operator_id: 1,
      operator: 'admin01',
      request: JSON.stringify({
        url: '/api/admins',
        method: 'POST',
        payload: { username: 'admin06', role: 'senior_manager' },
      }),
      created_at: daysAgo(now, 10),
    },
    // DELETE_MESSAGE × 3
    {
      operation_type: 'DELETE_MESSAGE',
      operator_id: 2,
      operator: 'admin02',
      request: JSON.stringify({
        url: '/api/messages/101',
        method: 'DELETE',
        payload: {},
      }),
      created_at: daysAgo(now, 2),
    },
    {
      operation_type: 'DELETE_MESSAGE',
      operator_id: 1,
      operator: 'admin01',
      request: JSON.stringify({
        url: '/api/messages/102',
        method: 'DELETE',
        payload: {},
      }),
      created_at: daysAgo(now, 7),
    },
    {
      operation_type: 'DELETE_MESSAGE',
      operator_id: 2,
      operator: 'admin02',
      request: JSON.stringify({
        url: '/api/messages/103',
        method: 'DELETE',
        payload: {},
      }),
      created_at: daysAgo(now, 15),
    },
    // BLOCK_PLAYER × 3
    {
      operation_type: 'BLOCK_PLAYER',
      operator_id: 2,
      operator: 'admin02',
      request: JSON.stringify({
        url: '/api/blacklist',
        method: 'POST',
        payload: { playerId: 'player001', reason: '違規發言' },
      }),
      created_at: daysAgo(now, 3),
    },
    {
      operation_type: 'BLOCK_PLAYER',
      operator_id: 1,
      operator: 'admin01',
      request: JSON.stringify({
        url: '/api/blacklist',
        method: 'POST',
        payload: { playerId: 'player002', reason: '惡意洗版' },
      }),
      created_at: daysAgo(now, 8),
    },
    {
      operation_type: 'BLOCK_PLAYER',
      operator_id: 2,
      operator: 'admin02',
      request: JSON.stringify({
        url: '/api/blacklist',
        method: 'POST',
        payload: { playerId: 'player003', reason: '散布不當訊息' },
      }),
      created_at: daysAgo(now, 20),
    },
    // UNBLOCK_PLAYER × 2
    {
      operation_type: 'UNBLOCK_PLAYER',
      operator_id: 1,
      operator: 'admin01',
      request: JSON.stringify({
        url: '/api/blacklist/player001',
        method: 'DELETE',
        payload: {},
      }),
      created_at: daysAgo(now, 4),
    },
    {
      operation_type: 'UNBLOCK_PLAYER',
      operator_id: 2,
      operator: 'admin02',
      request: JSON.stringify({
        url: '/api/blacklist/player003',
        method: 'DELETE',
        payload: {},
      }),
      created_at: daysAgo(now, 12),
    },
    // BLOCK_IP × 2
    {
      operation_type: 'BLOCK_IP',
      operator_id: 1,
      operator: 'admin01',
      request: JSON.stringify({
        url: '/api/ip-blocks',
        method: 'POST',
        payload: { ip: '192.168.1.100', reason: '可疑活動' },
      }),
      created_at: daysAgo(now, 6),
    },
    {
      operation_type: 'BLOCK_IP',
      operator_id: 2,
      operator: 'admin02',
      request: JSON.stringify({
        url: '/api/ip-blocks',
        method: 'POST',
        payload: { ip: '10.0.0.50', reason: 'DDoS 攻擊' },
      }),
      created_at: daysAgo(now, 18),
    },
    // UNBLOCK_IP × 1
    {
      operation_type: 'UNBLOCK_IP',
      operator_id: 1,
      operator: 'admin01',
      request: JSON.stringify({
        url: '/api/ip-blocks/192.168.1.100',
        method: 'DELETE',
        payload: {},
      }),
      created_at: daysAgo(now, 9),
    },
    // CREATE_BROADCAST × 2
    {
      operation_type: 'CREATE_BROADCAST',
      operator_id: 1,
      operator: 'admin01',
      request: JSON.stringify({
        url: '/api/broadcasts',
        method: 'POST',
        payload: { message: '系統將於今晚 23:00 進行維護' },
      }),
      created_at: daysAgo(now, 11),
    },
    {
      operation_type: 'CREATE_BROADCAST',
      operator_id: 2,
      operator: 'admin02',
      request: JSON.stringify({
        url: '/api/broadcasts',
        method: 'POST',
        payload: { message: '歡迎參加新春活動！' },
      }),
      created_at: daysAgo(now, 22),
    },
    // APPROVE_REPORT × 1
    {
      operation_type: 'APPROVE_REPORT',
      operator_id: 2,
      operator: 'admin02',
      request: JSON.stringify({
        url: '/api/reports/1/approve',
        method: 'PUT',
        payload: { reason: '確認違規' },
      }),
      created_at: daysAgo(now, 13),
    },
    // REJECT_REPORT × 1
    {
      operation_type: 'REJECT_REPORT',
      operator_id: 1,
      operator: 'admin01',
      request: JSON.stringify({
        url: '/api/reports/2/reject',
        method: 'PUT',
        payload: { reason: '證據不足' },
      }),
      created_at: daysAgo(now, 16),
    },
    // APPROVE_NICKNAME × 1
    {
      operation_type: 'APPROVE_NICKNAME',
      operator_id: 2,
      operator: 'admin02',
      request: JSON.stringify({
        url: '/api/nickname-requests/5/approve',
        method: 'PUT',
        payload: {},
      }),
      created_at: daysAgo(now, 25),
    },
    // REJECT_NICKNAME × 1
    {
      operation_type: 'REJECT_NICKNAME',
      operator_id: 1,
      operator: 'admin01',
      request: JSON.stringify({
        url: '/api/nickname-requests/3/reject',
        method: 'PUT',
        payload: { reason: '暱稱含不當用語' },
      }),
      created_at: daysAgo(now, 28),
    },
  ];

  await knex('operation_logs').insert(records);
}

function daysAgo(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() - days);
  return d.toISOString().replace('T', ' ').substring(0, 19);
}
