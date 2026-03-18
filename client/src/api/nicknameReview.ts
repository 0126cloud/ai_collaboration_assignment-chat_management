import client from './client';
import type { TNicknameReviewItem, TNicknameReviewQuery } from '@shared/types/nicknameReview';
import type { TApiResponse } from '@shared/types/api';

interface IPaginatedResponse {
  success: true;
  data: TNicknameReviewItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const nicknameReviewApi = {
  list: (params?: TNicknameReviewQuery) =>
    client.get<IPaginatedResponse>('/api/players/nickname/reviews', { params }),
  approve: (username: string) =>
    client.post<TApiResponse<{ message: string }>>(`/api/players/${username}/nickname/approve`),
  reject: (username: string) =>
    client.post<TApiResponse<{ message: string }>>(`/api/players/${username}/nickname/reject`),
};
