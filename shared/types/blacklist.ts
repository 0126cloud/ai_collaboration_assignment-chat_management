export type TBlacklistItem = {
  id: number;
  block_type: 'player' | 'ip';
  target: string;
  reason: 'spam' | 'abuse' | 'advertisement';
  operator: string;
  chatroom_id: string;
  is_blocked: boolean;
  created_at: string;
};

export type TBlacklistQuery = {
  target?: string;
  reason?: string;
  chatroomId?: string;
  startDate?: string;
  endDate?: string;
  status?: 'blocked' | 'unblocked' | 'all';
  page?: number;
  pageSize?: number;
};

export type TCreatePlayerBlockPayload = {
  target: string;
  reason: 'spam' | 'abuse' | 'advertisement';
  chatroom_id?: string;
};

export type TCreateIpBlockPayload = {
  target: string;
  reason: 'spam' | 'abuse' | 'advertisement';
  chatroom_id?: string;
};
