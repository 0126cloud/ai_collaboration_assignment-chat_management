import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, '請輸入帳號'),
  password: z.string().min(1, '請輸入密碼'),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, '請輸入舊密碼'),
  newPassword: z.string().min(6, '新密碼至少 6 個字元'),
});
