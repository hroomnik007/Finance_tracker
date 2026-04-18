export interface JwtPayload {
  sub: string;
  iat?: number;
  exp?: number;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
}
