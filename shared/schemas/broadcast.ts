import { z } from 'zod';

export const broadcastQuerySchema = z.object({
  chatroom_id: z.string().optional(),
  status: z.enum(['scheduled', 'active', 'expired']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const createBroadcastSchema = z.object({
  message: z.string().min(1, '請輸入廣播訊息').max(500, '廣播訊息最多 500 字'),
  chatroom_id: z.string().min(1, '請選擇目標聊天室'),
  duration: z
    .number()
    .int()
    .min(1, '顯示時長至少 1 秒')
    .max(86400, '顯示時長最多 86400 秒（24 小時）'),
  start_at: z.string().datetime({ message: '開始時間格式不正確' }),
});
