import { z } from 'zod';

export const createAdminSchema = z.object({
  username: z.string().min(3, '帳號至少 3 個字元').max(50, '帳號最多 50 個字元'),
  password: z.string().min(6, '密碼至少 6 個字元'),
  role: z.enum(['general_manager', 'senior_manager']),
});

export const adminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  username: z.string().optional(),
  role: z.enum(['general_manager', 'senior_manager']).optional(),
});

export const updateAdminRoleSchema = z.object({
  role: z.enum(['general_manager', 'senior_manager'], { message: '角色值無效' }),
});

export const resetAdminPasswordSchema = z.object({
  newPassword: z.string().min(6, '密碼至少 6 個字元'),
});
