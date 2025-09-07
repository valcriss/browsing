import path from 'path';
import { __setConfigForTests } from '../config/config';
import { resolveSafePath, toRelative } from './pathSafe';

describe('pathSafe', () => {
  const root = path.resolve(process.cwd(), 'tmp-root');
  beforeAll(() => {
    __setConfigForTests({
      root,
      users: [],
      auth: { jwtSecret: 's', tokenTtlMinutes: 10 },
    } as any);
  });
  afterAll(() => __setConfigForTests(null));

  it('resolves inside root', () => {
    const p = resolveSafePath('a/b');
    expect(p.startsWith(root)).toBe(true);
  });

  it('blocks traversal', () => {
    expect(() => resolveSafePath('../etc/passwd')).toThrow();
  });

  it('toRelative returns . for root', () => {
    expect(toRelative(root)).toBe('.');
  });

  it('resolveSafePath of dot equals root', () => {
    const p = resolveSafePath('.');
    expect(p).toBe(root);
  });
});
