import { z } from 'zod';

export const nicknameReviewQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  username: z.string().optional(),
  nickname: z.string().optional(),
  applyStartDate: z.string().optional(),
  applyEndDate: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});
