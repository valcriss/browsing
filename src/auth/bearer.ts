import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { loadConfig } from '../config/config';
import type { JwtUser } from '../types/index.d.ts';

export function bearerRequired(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const auth = req.header('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const token = auth.slice('Bearer '.length).trim();
    const cfg = loadConfig();
    const payload = jwt.verify(token, cfg.auth.jwtSecret) as jwt.JwtPayload;
    const user: JwtUser = {
      username: String(payload.username),
      role: payload.role as 'admin' | 'user',
    };
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}

export function bearerFromHeaderOrQuery(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const auth = req.header('Authorization');
    const queryToken =
      typeof req.query.token === 'string'
        ? (req.query.token as string)
        : undefined;
    let token: string | undefined;
    if (auth && auth.startsWith('Bearer '))
      token = auth.slice('Bearer '.length).trim();
    else if (queryToken) token = queryToken;
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const cfg = loadConfig();
    const payload = jwt.verify(token, cfg.auth.jwtSecret) as jwt.JwtPayload;
    const user: JwtUser = {
      username: String(payload.username),
      role: payload.role as 'admin' | 'user',
    };
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
