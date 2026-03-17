import { z } from 'zod';

export const createAdminSchema = z.object({
  username: z.string().min(3, '帳號至少 3 個字元').max(50, '帳號最多 50 個字元'),
  password: z.string().min(6, '密碼至少 6 個字元'),
  role: z.enum(['general_manager', 'senior_manager']),
});
