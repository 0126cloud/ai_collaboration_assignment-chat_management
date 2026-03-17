import { z } from 'zod';

export const chatMessageQuerySchema = z.object({
  chatroomId: z.string().optional(),
  playerUsername: z.string().optional(),
  playerNickname: z.string().optional(),
  message: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1, '頁碼必須為正整數').optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(30),
});
