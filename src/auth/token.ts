import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { loadConfig } from '../config/config';
import type { JwtUser } from '../types/index.d.ts';

export function parseToken(req: Request): JwtUser | null {
  const auth = req.header('Authorization');
  const queryToken =
    typeof req.query.token === 'string'
      ? (req.query.token as string)
      : undefined;

  let token: string | undefined;
  if (auth && auth.startsWith('Bearer '))
    token = auth.slice('Bearer '.length).trim();
  else if (queryToken) token = queryToken;
  if (!token) return null;

  try {
    const cfg = loadConfig();
    const payload = jwt.verify(token, cfg.auth.jwtSecret) as jwt.JwtPayload;
    return {
      username: String(payload.username),
      role: payload.role as 'admin' | 'user',
    };
  } catch {
    return null;
  }
}
