import fs from 'fs';
import os from 'os';
import path from 'path';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../server';
import { __setConfigForTests } from '../config/config';

describe('routes', () => {
  let dir: string;
  let adminToken = '';
  let userToken = '';
  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-rt-'));
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'file.txt'), 'x');
    const adminHash = bcrypt.hashSync('admin', 10);
    const userHash = bcrypt.hashSync('user', 10);
    __setConfigForTests({
      root: dir,
      users: [
        { username: 'admin', passwordHash: adminHash, role: 'admin' },
        { username: 'alice', passwordHash: userHash, role: 'user' },
      ],
      auth: { jwtSecret: 's3cr3t', tokenTtlMinutes: 10 },
    } as any);
    const a = await request(app)
      .post('/api/login')
      .send({ username: 'admin', password: 'admin' });
    adminToken = a.body.token;
    const u = await request(app)
      .post('/api/login')
      .send({ username: 'alice', password: 'user' });
    userToken = u.body.token;
  });
  afterAll(() => {
    __setConfigForTests(null);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('GET /api/tree requires auth and responds', async () => {
    const no = await request(app).get('/api/tree');
    expect(no.status).toBe(401);
    const ok = await request(app)
      .get('/api/tree')
      .set('Authorization', `Bearer ${userToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body.cwd).toBe('.');
  });

  it('GET /api/file streams file and 400 on dir', async () => {
    const fileRes = await request(app)
      .get('/api/file')
      .query({ path: 'file.txt' })
      .set('Authorization', `Bearer ${userToken}`);
    expect(fileRes.status).toBe(200);
    // token via query param should also work (for streaming anchor usage)
    const fileRes2 = await request(app)
      .get('/api/file')
      .query({ path: 'file.txt', token: userToken });
    expect(fileRes2.status).toBe(200);
    const dirRes = await request(app)
      .get('/api/file')
      .query({ path: 'sub' })
      .set('Authorization', `Bearer ${userToken}`);
    expect(dirRes.status).toBe(400);
  });

  it('GET /api/zip zips dir and 400 on file/403 escape', async () => {
    const no = await request(app).get('/api/zip').query({ path: 'sub' });
    expect(no.status).toBe(401);
    const ok = await request(app)
      .get('/api/zip')
      .query({ path: 'sub' })
      .set('Authorization', `Bearer ${userToken}`);
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toBe('application/zip');
    const bad = await request(app)
      .get('/api/zip')
      .query({ path: 'file.txt' })
      .set('Authorization', `Bearer ${userToken}`);
    expect(bad.status).toBe(400);
    const esc = await request(app)
      .get('/api/zip')
      .query({ path: '../etc' })
      .set('Authorization', `Bearer ${userToken}`);
    expect(esc.status).toBe(403);
  });

  it('GET /api/tree 400 on file and 403 on escape', async () => {
    const bad = await request(app)
      .get('/api/tree')
      .query({ path: 'file.txt' })
      .set('Authorization', `Bearer ${userToken}`);
    expect(bad.status).toBe(400);
    const esc = await request(app)
      .get('/api/tree')
      .query({ path: '../etc' })
      .set('Authorization', `Bearer ${userToken}`);
    expect(esc.status).toBe(403);
  });

  it('POST /api/move requires admin', async () => {
    const no = await request(app)
      .post('/api/move')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ from: 'file.txt', to: 'sub/file.txt' });
    expect(no.status).toBe(403);
    const ok = await request(app)
      .post('/api/move')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ from: 'file.txt', to: 'sub/file.txt' });
    expect(ok.status).toBe(200);
    expect(fs.existsSync(path.join(dir, 'sub/file.txt'))).toBe(true);
  });

  it('DELETE /api/file requires admin', async () => {
    const no = await request(app)
      .delete('/api/file')
      .query({ path: 'sub/file.txt' })
      .set('Authorization', `Bearer ${userToken}`);
    expect(no.status).toBe(403);
    const ok = await request(app)
      .delete('/api/file')
      .query({ path: 'sub/file.txt' })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(ok.status).toBe(200);
    expect(fs.existsSync(path.join(dir, 'sub/file.txt'))).toBe(false);
  });

  it('DELETE /api/file 400 if missing path', async () => {
    const bad = await request(app)
      .delete('/api/file')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(bad.status).toBe(400);
  });

  it('POST /api/move 400 missing fields', async () => {
    const res = await request(app)
      .post('/api/move')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('Admin endpoints error path (403) on escape', async () => {
    const mv = await request(app)
      .post('/api/move')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ from: '../x', to: 'sub/x' });
    expect(mv.status).toBe(403);
    const del = await request(app)
      .delete('/api/file')
      .query({ path: '../x' })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(403);
  });
});
