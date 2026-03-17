import client from './client';
import type {
  TBroadcastItem,
  TBroadcastQuery,
  TCreateBroadcastPayload,
} from '@shared/types/broadcast';
import type { TApiResponse } from '@shared/types/api';

interface IPaginatedResponse {
  success: true;
  data: TBroadcastItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const broadcastApi = {
  list: (params?: TBroadcastQuery) => client.get<IPaginatedResponse>('/api/broadcasts', { params }),
  create: (data: TCreateBroadcastPayload) =>
    client.post<TApiResponse<TBroadcastItem>>('/api/broadcasts', data),
  remove: (id: number) => client.delete<TApiResponse<{ message: string }>>(`/api/broadcasts/${id}`),
};
