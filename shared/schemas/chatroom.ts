import { z } from 'zod';

export const chatroomQuerySchema = z.object({
  name: z.string().optional(),
  page: z.coerce.number().int().min(1, '頁碼必須為正整數').optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(30),
});
