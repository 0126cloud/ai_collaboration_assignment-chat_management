import client from './client';
import type { TApiResponse } from '@shared/types/api';

export const playerApi = {
  resetNickname: (username: string) =>
    client.put<TApiResponse<{ message: string; username: string }>>(
      `/api/players/${username}/nickname/reset`,
    ),
};
