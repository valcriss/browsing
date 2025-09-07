import fs from 'fs';
import os from 'os';
import path from 'path';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import EventEmitter from 'events';
import app from '../server';
import { __setConfigForTests } from '../config/config';

describe('file route stream error', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-rt-err-'));
  const file = path.join(dir, 'boom.txt');
  beforeAll(() => {
    fs.writeFileSync(file, 'x');
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

  it('responds 500 when stream errors', async () => {
    const token = (
      await request(app)
        .post('/api/login')
        .send({ username: 'admin', password: 'admin' })
    ).body.token;
    const mock = jest.spyOn(fs, 'createReadStream').mockImplementation(() => {
      const ee: any = new EventEmitter();
      process.nextTick(() => ee.emit('error', new Error('oops')));
      return ee;
    });
    const res = await request(app)
      .get('/api/file')
      .query({ path: 'boom.txt' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(500);
    mock.mockRestore();
  });
});
