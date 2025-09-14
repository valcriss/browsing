import fs from 'fs';
import os from 'os';
import path from 'path';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { __setConfigForTests } from '../config/config';

jest.mock('archiver', () => {
  return () => {
    const ee = new (require('events').EventEmitter)();
    (ee as any).pipe = () => ee;
    (ee as any).directory = () => ee;
    (ee as any).finalize = () => {
      process.nextTick(() => ee.emit('error', new Error('boom')));
    };
    return ee;
  };
});

// import after mocking
import app from '../server';

describe('zip route stream error', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-zip-err-'));
  beforeAll(() => {
    fs.mkdirSync(path.join(dir, 'sub'));
    const adminHash = bcrypt.hashSync('admin', 10);
    __setConfigForTests({
      root: dir,
      users: [{ username: 'admin', passwordHash: adminHash, role: 'admin' }],
      auth: { jwtSecret: 's', tokenTtlMinutes: 10 },
    } as any);
  });
  afterAll(() => {
    __setConfigForTests(null);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('responds 500 when archiver errors', async () => {
    const token = (
      await request(app)
        .post('/api/login')
        .send({ username: 'admin', password: 'admin' })
    ).body.token;
    const res = await request(app)
      .get('/api/zip')
      .query({ path: 'sub' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(500);
  });
});
