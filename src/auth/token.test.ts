import jwt from 'jsonwebtoken';
import { parseToken } from './token';
import { __setConfigForTests } from '../config/config';
import type { Request } from 'express';

describe('parseToken', () => {
  beforeAll(() => {
    __setConfigForTests({
      root: process.cwd(),
      users: [],
      auth: { jwtSecret: 'secret', tokenTtlMinutes: 1 },
    } as any);
  });
  afterAll(() => __setConfigForTests(null));

  function makeReq(
    headerValue?: string,
    query: Record<string, unknown> = {},
  ): Request {
    return {
      header: (name: string) =>
        name === 'Authorization' ? headerValue : undefined,
      query,
    } as unknown as Request;
  }

  it('returns user for valid header token', () => {
    const token = jwt.sign({ username: 'a', role: 'user' }, 'secret', {
      expiresIn: 60,
    });
    const req = makeReq(`Bearer ${token}`);
    expect(parseToken(req)).toEqual({ username: 'a', role: 'user' });
  });

  it('returns null for invalid token', () => {
    const req = makeReq('Bearer notatoken');
    expect(parseToken(req)).toBeNull();
  });

  it('returns user for token in query', () => {
    const token = jwt.sign({ username: 'a', role: 'admin' }, 'secret', {
      expiresIn: 60,
    });
    const req = makeReq(undefined, { token });
    expect(parseToken(req)).toEqual({ username: 'a', role: 'admin' });
  });

  it('returns null when token missing', () => {
    const req = makeReq();
    expect(parseToken(req)).toBeNull();
  });
});
