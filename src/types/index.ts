export interface User {
  userId: string;
  metadata?: Record<string, any>;
}

export interface Credentials {
  access_token?: string;
  api_key?: string;
  [key: string]: any;
}
