import { z } from 'zod';

export const operationLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1, '頁碼必須 >= 1').optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100, '每頁最多 100 筆').optional().default(20),
  operationType: z.string().optional(),
  operator: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
