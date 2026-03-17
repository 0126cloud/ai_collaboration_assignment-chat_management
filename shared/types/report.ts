export type TReportStatus = 'pending' | 'approved' | 'rejected';
export type TReportReason = 'spam' | 'abuse' | 'advertisement';

export type TReportItem = {
  id: number;
  reporter_username: string;
  target_username: string;
  chatroom_id: string;
  chat_message_id: number | null;
  chat_message: string;
  reason: TReportReason;
  status: TReportStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type TReportQuery = {
  status?: TReportStatus;
  reporterUsername?: string;
  targetUsername?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
};
