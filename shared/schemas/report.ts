import { z } from 'zod';

export const reportStatusValues = ['pending', 'approved', 'rejected'] as const;

export const reportQuerySchema = z.object({
  status: z.enum(reportStatusValues).optional().default('pending'),
  reporterUsername: z.string().optional(),
  targetUsername: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});
