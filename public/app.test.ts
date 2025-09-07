import {
  authHeader,
  setSession,
  getSession,
  isAdmin,
  extractDragPath,
} from './app';

function mockSessionStorage() {
  const store = new Map<string, string>();
  (global as any).sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
}

describe('frontend helpers', () => {
  beforeEach(() => {
    mockSessionStorage();
  });

  it('stores and reads session', () => {
    setSession({ token: 't', user: { username: 'u', role: 'user' } });
    expect(getSession()?.token).toBe('t');
    setSession(null); // cover clear branch
  });

  it('authHeader builds bearer', () => {
    setSession({ token: 'abc', user: { username: 'u', role: 'user' } });
    expect(authHeader()).toEqual({ Authorization: 'Bearer abc' });
  });

  it('isAdmin reflects role', () => {
    setSession({ token: 't', user: { username: 'a', role: 'admin' } });
    expect(isAdmin()).toBe(true);
  });

  it('DnD extractDragPath', () => {
    const dt = {
      getData: (t: string) => (t === 'text/plain' ? 'x/y' : null),
    } as any;
    expect(extractDragPath(dt)).toBe('x/y');
  });

  it('handles no sessionStorage and empty session', () => {
    (global as any).sessionStorage = undefined;
    setSession(null);
    expect(authHeader()).toEqual({});
    // restore
    mockSessionStorage();
    expect(getSession()).toBeNull();
  });

  it('login() success stores session', async () => {
    (global as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        token: 'tok',
        user: { username: 'u', role: 'user' },
      }),
    }));
    const mod = await import('./app');
    const sess = await mod.login('u', 'p');
    expect(sess.token).toBe('tok');
    expect(getSession()?.token).toBe('tok');
  });
});
