import client from './client';
import type { TChatMessageQuery, TChatMessageItem } from '@shared/types/chatMessage';
import type { TApiResponse } from '@shared/types/api';

interface IPaginatedResponse {
  success: true;
  data: TChatMessageItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const chatMessageApi = {
  list: (params?: TChatMessageQuery) =>
    client.get<IPaginatedResponse>('/api/chat_messages', { params }),
  remove: (id: number) =>
    client.delete<TApiResponse<{ message: string }>>(`/api/chat_messages/${id}`),
};
