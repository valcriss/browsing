import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { loadConfig } from '../config/config';

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body ?? {};
  if (
    !username ||
    !password ||
    typeof username !== 'string' ||
    typeof password !== 'string'
  ) {
    res.status(400).json({ error: 'Missing fields' });
    return;
  }
  const cfg = loadConfig();
  const user = cfg.users.find((u) => u.username === username);
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const ttl = Math.floor(cfg.auth.tokenTtlMinutes * 60);
  const token = jwt.sign(
    { username: user.username, role: user.role },
    cfg.auth.jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: ttl,
    },
  );
  res.json({ token, user: { username: user.username, role: user.role } });
}
/* istanbul ignore file */
