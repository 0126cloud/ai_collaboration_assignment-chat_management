import client from './client';
import type { TChatroomQuery, TChatroomItem } from '@shared/types/chatroom';

interface IPaginatedResponse {
  success: true;
  data: TChatroomItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const chatroomApi = {
  list: (params?: TChatroomQuery) => client.get<IPaginatedResponse>('/api/chatrooms', { params }),
};
