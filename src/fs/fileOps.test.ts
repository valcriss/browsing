import fs from 'fs';
import os from 'os';
import path from 'path';
import { __setConfigForTests } from '../config/config';
import { list, getFileMeta, move, remove } from './fileOps';

describe('fileOps', () => {
  let dir: string;
  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-'));
    fs.mkdirSync(path.join(dir, 'dir'));
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
    // dotfiles should be ignored
    fs.writeFileSync(path.join(dir, '.hidden'), 'x');
    fs.mkdirSync(path.join(dir, '.git'));
    __setConfigForTests({
      root: dir,
      users: [],
      auth: { jwtSecret: 's', tokenTtlMinutes: 10 },
    } as any);
  });
  afterEach(() => {
    __setConfigForTests(null);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('lists sorted', async () => {
    const res = await list('.');
    expect(res.items[0].isDir).toBe(true);
    expect(res.items.map((i) => i.name)).toEqual(['dir', 'a.txt', 'b.txt']);
  });

  it('meta and stream-able file', async () => {
    const meta = await getFileMeta('a.txt');
    expect(meta.size).toBe(1);
  });

  it('move and remove', async () => {
    await move('a.txt', 'dir/a.txt');
    expect(fs.existsSync(path.join(dir, 'dir/a.txt'))).toBe(true);
    await remove('dir');
    expect(fs.existsSync(path.join(dir, 'dir'))).toBe(false);
  });

  it('list on file throws 400', async () => {
    await expect(list('a.txt')).rejects.toMatchObject({ status: 400 });
  });

  it('list subdir yields parent path and mime fallback', async () => {
    fs.writeFileSync(path.join(dir, 'dir', 'noext'), 'x');
    const sub = await list('dir');
    expect(sub.parent).toBe('.');
    const meta2 = await getFileMeta('dir/noext');
    expect(meta2.mimeType).toBe('application/octet-stream');
  });
});
