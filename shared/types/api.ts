export type TApiResponse<T> = {
  success: true;
  data: T;
};

export type TApiError = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};
