import { z } from 'zod';

const IP_PATTERN = /^(\d{1,3}\.){3}(\d{1,3}|\*)$/;
const REASON_ENUM = z.enum(['spam', 'abuse', 'advertisement']);

export const blacklistQuerySchema = z.object({
  target: z.string().optional(),
  reason: REASON_ENUM.optional(),
  chatroomId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['blocked', 'unblocked', 'all']).optional().default('blocked'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(30),
});

export const createPlayerBlockSchema = z.object({
  target: z.string().min(1, '請輸入玩家帳號'),
  reason: REASON_ENUM,
  chatroom_id: z.string().optional().default('all'),
});

export const createIpBlockSchema = z.object({
  target: z
    .string()
    .min(1, '請輸入 IP 位址')
    .regex(IP_PATTERN, 'IP 格式不正確，支援精確 IP 或萬用字元（如 116.62.238.* ）'),
  reason: REASON_ENUM,
  chatroom_id: z.string().optional().default('all'),
});
