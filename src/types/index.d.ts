/* eslint-disable @typescript-eslint/no-empty-object-type */
export interface UserConfig {
  username: string;
  passwordHash: string;
  role: 'admin' | 'user';
}

export interface AuthConfig {
  jwtSecret: string;
  tokenTtlMinutes: number;
}

export interface AppConfig {
  root: string; // absolute path
  users: UserConfig[];
  auth: AuthConfig;
}

export interface JwtUser {
  username: string;
  role: 'admin' | 'user';
}

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends JwtUser {}
    interface Request {
      user?: JwtUser;
    }
  }
}
