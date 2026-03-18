import client from './client';
import type {
  TAdminItem,
  TAdminListQuery,
  TCreateAdminPayload,
  TUpdateAdminRolePayload,
} from '@shared/types/admin';
import type { TApiResponse } from '@shared/types/api';

interface IPaginatedResponse {
  success: true;
  data: TAdminItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const adminApi = {
  list: (params?: TAdminListQuery) => client.get<IPaginatedResponse>('/api/admins', { params }),
  create: (data: TCreateAdminPayload) => client.post<TApiResponse<TAdminItem>>('/api/admins', data),
  toggle: (id: number) => client.put<TApiResponse<TAdminItem>>(`/api/admins/${id}/toggle`),
  updateRole: (id: number, data: TUpdateAdminRolePayload) =>
    client.patch<TApiResponse<TAdminItem>>(`/api/admins/${id}/role`, data),
};
