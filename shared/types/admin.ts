import type { z } from 'zod';
import type {
  createAdminSchema,
  adminListQuerySchema,
  updateAdminRoleSchema,
} from '../schemas/admin';

export type TCreateAdminPayload = z.infer<typeof createAdminSchema>;

export type TCreateAdminResponse = {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export type TAdminItem = {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export type TAdminListQuery = z.infer<typeof adminListQuerySchema>;

export type TUpdateAdminRolePayload = z.infer<typeof updateAdminRoleSchema>;
