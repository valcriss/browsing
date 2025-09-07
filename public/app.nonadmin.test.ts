/** @jest-environment jsdom */

function setupDOM() {
  document.body.innerHTML = `
  <div>
    <input id="username" />
    <input id="password" />
    <button id="loginBtn"></button>
    <button id="logoutBtn" class="hidden"></button>
    <span id="roleBadge"></span>
    <div id="breadcrumb"></div>
    <ul id="list"></ul>
  </div>`;
}

describe('frontend non-admin UI', () => {
  beforeEach(() => {
    setupDOM();
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
    (global as any).URL.createObjectURL = () => 'blob:';
    (global as any).URL.revokeObjectURL = () => {};
    (global as any).fetch = jest.fn(async (url: string) => {
      if (url === '/api/login')
        return {
          ok: true,
          json: async () => ({
            token: 't',
            user: { username: 'alice', role: 'user' },
          }),
        } as any;
      if (url.startsWith('/api/tree'))
        return {
          ok: true,
          json: async () => ({
            cwd: '.',
            parent: null,
            items: [
              {
                name: 'f.txt',
                isDir: false,
                size: 1,
                mtime: new Date().toISOString(),
              },
            ],
            user: { username: 'alice', role: 'user' },
          }),
        } as any;
      if (url.startsWith('/api/file?path='))
        return {
          ok: true,
          blob: async () => new Blob(['x'], { type: 'text/plain' }),
        } as any;
      return { ok: false } as any;
    });
  });

  it('does not show delete button for user role', async () => {
    const mod = await import('./app');
    // ensure session as non-admin
    mod.setSession({ token: 't', user: { username: 'alice', role: 'user' } });
    (document.getElementById('loginBtn') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    const list = document.getElementById('list')!;
    expect(list.querySelector('button')).toBeNull();
  });
});
