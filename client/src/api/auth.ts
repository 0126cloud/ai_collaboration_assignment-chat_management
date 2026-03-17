import client from './client';
import type { TLoginPayload, TChangePasswordPayload, TMeResponse } from '@shared/types/auth';
import type { TApiResponse } from '@shared/types/api';
import type { TLoginResponse, TPermissionsResponse } from '@shared/types/auth';

export const authApi = {
  login: (data: TLoginPayload) =>
    client.post<TApiResponse<TLoginResponse>>('/api/auth/login', data),

  getMe: () => client.get<TApiResponse<TMeResponse>>('/api/auth/me'),

  logout: () => client.post<TApiResponse<{ message: string }>>('/api/auth/logout'),

  changePassword: (data: TChangePasswordPayload) =>
    client.put<TApiResponse<{ message: string }>>('/api/auth/password', data),

  getPermissions: () => client.get<TApiResponse<TPermissionsResponse>>('/api/auth/permissions'),
};
