export type TChatMessageItem = {
  id: number;
  chatroom_id: string;
  player_username: string;
  player_nickname: string;
  message: string;
  created_at: string;
};

export type TChatMessageQuery = {
  chatroomId?: string;
  playerUsername?: string;
  playerNickname?: string;
  message?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
};
