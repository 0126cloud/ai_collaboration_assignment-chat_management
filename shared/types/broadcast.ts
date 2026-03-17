export type TBroadcastStatus = 'scheduled' | 'active' | 'expired';

export type TBroadcastItem = {
  id: number;
  message: string;
  chatroom_id: string;
  duration: number;
  start_at: string;
  operator: string;
  created_at: string;
  status: TBroadcastStatus;
};

export type TBroadcastQuery = {
  chatroom_id?: string;
  status?: TBroadcastStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
};

export type TCreateBroadcastPayload = {
  message: string;
  chatroom_id: string;
  duration: number;
  start_at: string;
};
