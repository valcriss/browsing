import fs from 'fs';
import path from 'path';
import { __setConfigForTests } from '../config/config';
import { resolveSafePath, toRelative } from './pathSafe';

describe('pathSafe', () => {
  const root = path.resolve(process.cwd(), 'tmp-root');
  beforeAll(() => {
    fs.mkdirSync(root, { recursive: true });
    __setConfigForTests({
      root,
      users: [],
      auth: { jwtSecret: 's', tokenTtlMinutes: 10 },
    } as any);
  });
  afterAll(() => {
    __setConfigForTests(null);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('resolves inside root', async () => {
    const p = await resolveSafePath('a/b');
    expect(p.startsWith(root)).toBe(true);
  });

  it('blocks traversal', async () => {
    await expect(resolveSafePath('../etc/passwd')).rejects.toThrow();
  });

  it('toRelative returns . for root', () => {
    expect(toRelative(root)).toBe('.');
  });

  it('resolveSafePath of dot equals root', async () => {
    const p = await resolveSafePath('.');
    expect(p).toBe(root);
  });

  it('rejects symlink outside root', async () => {
    const outside = path.resolve(process.cwd(), 'tmp-out');
    fs.mkdirSync(outside, { recursive: true });
    const link = path.join(root, 'link-out');
    fs.symlinkSync(outside, link);
    await expect(resolveSafePath('link-out')).rejects.toMatchObject({
      status: 403,
    });
    fs.rmSync(link, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });
});
