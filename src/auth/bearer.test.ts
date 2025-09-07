import jwt from 'jsonwebtoken';
import request from 'supertest';
import { __setConfigForTests } from '../config/config';
import app from '../server';

describe('bearer middleware', () => {
  beforeAll(() => {
    __setConfigForTests({
      root: process.cwd(),
      users: [],
      auth: { jwtSecret: 'secret', tokenTtlMinutes: 1 },
    } as any);
  });
  afterAll(() => __setConfigForTests(null));

  it('rejects missing token', async () => {
    const res = await request(app).get('/api/tree');
    expect(res.status).toBe(401);
  });

  it('accepts valid token', async () => {
    const token = jwt.sign({ username: 'a', role: 'user' }, 'secret', {
      expiresIn: 60,
    });
    const res = await request(app)
      .get('/api/tree')
      .set('Authorization', `Bearer ${token}`);
    expect([200, 400]).toContain(res.status); // tree may 400 because cwd not set up
  });

  it('rejects expired token', async () => {
    const token = jwt.sign({ username: 'a', role: 'user' }, 'secret', {
      expiresIn: -1,
    });
    const res = await request(app)
      .get('/api/tree')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('rejects malformed token', async () => {
    const res = await request(app)
      .get('/api/tree')
      .set('Authorization', 'Bearer notatoken');
    expect(res.status).toBe(401);
  });

  it('file route: rejects when no Authorization and no token query', async () => {
    const res = await request(app).get('/api/file').query({ path: 'x' });
    expect(res.status).toBe(401);
  });

  it('file route: rejects malformed token in query', async () => {
    const res = await request(app)
      .get('/api/file')
      .query({ path: 'x', token: 'badtoken' });
    expect(res.status).toBe(401);
  });
});
