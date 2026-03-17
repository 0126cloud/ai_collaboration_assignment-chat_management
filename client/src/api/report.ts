import client from './client';
import type { TReportItem, TReportQuery } from '@shared/types/report';
import type { TApiResponse } from '@shared/types/api';

interface IPaginatedResponse {
  success: true;
  data: TReportItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const reportApi = {
  list: (params?: TReportQuery) => client.get<IPaginatedResponse>('/api/reports', { params }),
  approve: (id: number) =>
    client.post<TApiResponse<{ message: string }>>(`/api/reports/${id}/approve`),
  reject: (id: number) =>
    client.post<TApiResponse<{ message: string }>>(`/api/reports/${id}/reject`),
};
