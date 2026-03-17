import type { z } from 'zod';
import type { loginSchema, changePasswordSchema } from '../schemas/auth';

export type TLoginPayload = z.infer<typeof loginSchema>;
export type TChangePasswordPayload = z.infer<typeof changePasswordSchema>;

export type TLoginResponse = {
  token: string;
  user: {
    id: number;
    username: string;
    role: string;
  };
};

export type TPermissionsResponse = {
  role: string;
  permissions: string[];
};

export type TMeResponse = {
  user: {
    id: number;
    username: string;
    role: string;
  };
  permissions: string[];
};
