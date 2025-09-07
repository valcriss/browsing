import bcrypt from 'bcryptjs';
import request from 'supertest';
import { __setConfigForTests } from '../config/config';
import app from '../server';

describe('login', () => {
  beforeAll(() => {
    const hash = bcrypt.hashSync('secret', 10);
    __setConfigForTests({
      root: process.cwd(),
      users: [{ username: 'admin', passwordHash: hash, role: 'admin' }],
      auth: { jwtSecret: 's', tokenTtlMinutes: 1 },
    } as any);
  });
  afterAll(() => __setConfigForTests(null));

  it('accepts valid creds', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'admin', password: 'secret' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toEqual({ username: 'admin', role: 'admin' });
  });

  it('rejects invalid creds', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'admin', password: 'nope' });
    expect(res.status).toBe(401);
  });

  it('400 on missing fields', async () => {
    const res = await request(app).post('/api/login').send({});
    expect(res.status).toBe(400);
  });

  it('401 on unknown user', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'ghost', password: 'x' });
    expect(res.status).toBe(401);
  });
});
