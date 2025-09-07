import path from 'path';
import { validateConfig, __setConfigForTests, loadConfig } from './config';

describe('config validation', () => {
  afterEach(() => __setConfigForTests(null));

  const base = {
    root: path.resolve('/tmp'),
    users: [{ username: 'a', passwordHash: 'x', role: 'admin' as const }],
    auth: { jwtSecret: 's', tokenTtlMinutes: 10 },
  };

  it('validates correct config', () => {
    expect(validateConfig(base)).toBeTruthy();
  });

  it('rejects non-absolute root', () => {
    expect(() => validateConfig({ ...base, root: 'rel' })).toThrow();
  });

  it('rejects invalid object', () => {
    expect(() => validateConfig(null as any)).toThrow();
  });

  it('rejects root wrong type', () => {
    expect(() => validateConfig({ ...base, root: 123 as any })).toThrow();
  });

  it('rejects bad user', () => {
    expect(() =>
      validateConfig({ ...base, users: [{ username: 'x' }] as any }),
    ).toThrow();
  });

  it('rejects invalid role', () => {
    expect(() =>
      validateConfig({
        ...base,
        users: [{ username: 'a', passwordHash: 'h', role: 'x' as any }] as any,
      }),
    ).toThrow();
  });

  it('rejects user missing passwordHash', () => {
    expect(() =>
      validateConfig({
        ...base,
        users: [{ username: 'a', role: 'admin' } as any] as any,
      }),
    ).toThrow();
  });

  it('rejects user missing username', () => {
    expect(() =>
      validateConfig({
        ...base,
        users: [{ passwordHash: 'h', role: 'admin' } as any] as any,
      }),
    ).toThrow();
  });

  it('rejects missing auth', () => {
    expect(() => validateConfig({ ...base, auth: undefined as any })).toThrow();
  });

  it('rejects non-positive ttl', () => {
    expect(() =>
      validateConfig({ ...base, auth: { jwtSecret: 's', tokenTtlMinutes: 0 } }),
    ).toThrow();
  });

  it('rejects missing jwtSecret', () => {
    const bad = {
      ...base,
      auth: { jwtSecret: undefined as any, tokenTtlMinutes: 10 },
    };
    expect(() => validateConfig(bad)).toThrow();
  });

  it('rejects users non-array', () => {
    expect(() => validateConfig({ ...base, users: null as any })).toThrow();
  });

  it('loadConfig returns cached', () => {
    __setConfigForTests(base as any);
    const a = loadConfig();
    const b = loadConfig();
    expect(a).toBe(b);
  });

  it('loadConfig reads file from cwd', () => {
    const cwd = process.cwd();
    const tmp = path.join(cwd, '.tmp-cfg');
    const fs = require('fs');
    fs.mkdirSync(tmp, { recursive: true });
    const cfg = { ...base };
    fs.writeFileSync(path.join(tmp, 'configuration.json'), JSON.stringify(cfg));
    process.chdir(tmp);
    __setConfigForTests(null);
    const loaded = loadConfig();
    expect(loaded.root).toBe(base.root);
    process.chdir(cwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
