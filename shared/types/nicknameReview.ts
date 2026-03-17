export type TNicknameReviewStatus = 'pending' | 'approved' | 'rejected';

export type TNicknameReviewItem = {
  username: string;
  nickname: string;
  nickname_apply_at: string | null;
  nickname_review_status: TNicknameReviewStatus | null;
  nickname_reviewed_by: string | null;
  nickname_reviewed_at: string | null;
};

export type TNicknameReviewQuery = {
  status?: TNicknameReviewStatus;
  username?: string;
  nickname?: string;
  applyStartDate?: string;
  applyEndDate?: string;
  page?: number;
  pageSize?: number;
};
