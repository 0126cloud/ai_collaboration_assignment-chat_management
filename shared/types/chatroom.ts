export type TChatroomItem = {
  id: string;
  name: string;
  online_user_count: number;
  created_at: string;
  updated_at: string;
};

export type TChatroomQuery = {
  name?: string;
  page?: number;
  pageSize?: number;
};
