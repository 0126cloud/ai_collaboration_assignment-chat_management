import client from './client';
import type { TOperationLogQuery, TOperationLogItem } from '@shared/types/operationLog';

interface IPaginatedResponse {
  success: true;
  data: TOperationLogItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const operationLogApi = {
  list: (params?: TOperationLogQuery) =>
    client.get<IPaginatedResponse>('/api/operation-logs', { params }),
};
