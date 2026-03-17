import type { z } from 'zod';
import type { createAdminSchema } from '../schemas/admin';

export type TCreateAdminPayload = z.infer<typeof createAdminSchema>;

export type TCreateAdminResponse = {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
  created_at: string;
};
