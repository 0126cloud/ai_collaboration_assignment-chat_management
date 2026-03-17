import client from './client';
import type {
  TBlacklistItem,
  TBlacklistQuery,
  TCreatePlayerBlockPayload,
  TCreateIpBlockPayload,
} from '@shared/types/blacklist';
import type { TApiResponse } from '@shared/types/api';

interface IPaginatedResponse {
  success: true;
  data: TBlacklistItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const blacklistApi = {
  listPlayers: (params?: TBlacklistQuery) =>
    client.get<IPaginatedResponse>('/api/blacklist/player', { params }),
  listIps: (params?: TBlacklistQuery) =>
    client.get<IPaginatedResponse>('/api/blacklist/ip', { params }),
  blockPlayer: (data: TCreatePlayerBlockPayload) =>
    client.post<TApiResponse<TBlacklistItem>>('/api/blacklist/player', data),
  blockIp: (data: TCreateIpBlockPayload) =>
    client.post<TApiResponse<TBlacklistItem>>('/api/blacklist/ip', data),
  unblockPlayer: (id: number) =>
    client.delete<TApiResponse<{ message: string }>>(`/api/blacklist/player/${id}`),
  unblockIp: (id: number) =>
    client.delete<TApiResponse<{ message: string }>>(`/api/blacklist/ip/${id}`),
};
