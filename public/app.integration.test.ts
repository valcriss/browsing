/** @jest-environment jsdom */
import * as appmod from './app';

function setupDOM() {
  document.body.innerHTML = `
  <div>
    <input id="username" />
    <input id="password" />
    <button id="loginBtn"></button>
    <button id="logoutBtn" class="hidden"></button>
    <span id="roleBadge"></span>
    <div id="breadcrumb"></div>
    <ul id="tree"></ul>
    <ul id="list"></ul>
  </div>`;
}

describe('frontend integration', () => {
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
    (global as any).fetch = jest.fn(async (url: string, opts?: any) => {
      if (url === '/api/login') {
        return {
          ok: true,
          json: async () => ({
            token: 't',
            user: { username: 'admin', role: 'admin' },
          }),
        } as any;
      }
      if (url.startsWith('/api/tree')) {
        return {
          ok: true,
          json: async () => ({
            cwd: '.',
            parent: null,
            items: [
              {
                name: 'dir',
                isDir: true,
                size: null,
                mtime: new Date().toISOString(),
              },
              {
                name: 'f.txt',
                isDir: false,
                size: 1,
                mtime: new Date().toISOString(),
              },
            ],
            user: { username: 'admin', role: 'admin' },
          }),
        } as any;
      }
      if (url.startsWith('/api/file?path=')) {
        if (opts?.method === 'DELETE')
          return { ok: true, json: async () => ({ ok: true }) } as any;
        return {
          ok: true,
          blob: async () => new Blob(['x'], { type: 'text/plain' }),
        } as any;
      }
      if (url === '/api/move')
        return { ok: true, json: async () => ({ ok: true }) } as any;
      return { ok: false } as any;
    });
  });

  it('logs in, renders list, and shows admin actions', async () => {
    // importing module sets up init and handlers
    await import('./app');
    (document.getElementById('username') as HTMLInputElement).value = 'admin';
    (document.getElementById('password') as HTMLInputElement).value = 'pwd';
    (document.getElementById('loginBtn') as HTMLButtonElement).click();
    // wait a tick
    await new Promise((r) => setTimeout(r, 0));
    expect(
      (document.getElementById('roleBadge') as HTMLElement).textContent,
    ).toContain('admin');
    // click file download
    const list = document.getElementById('list')!;
    // click the file link specifically (right pane)
    const links = Array.from(list.querySelectorAll('a')) as HTMLAnchorElement[];
    const fileLink = links.find((a) => a.textContent?.startsWith('📄'))!;
    fileLink.click();
    // simulate delete button
    const deleteBtn = list.querySelector('button') as HTMLButtonElement;
    deleteBtn.click();

    // simulate drop (move)
    const folderLi = Array.from(document.querySelectorAll('#tree li')).find(
      (li) => li.textContent?.includes('dir'),
    )!;
    const evt = new Event('drop', { bubbles: true, cancelable: true }) as any;
    evt.dataTransfer = { getData: () => 'f.txt' };
    folderLi.dispatchEvent(evt);

    // force move failure to hit catch
    (global.fetch as jest.Mock).mockImplementationOnce(async () => {
      throw new Error('fail');
    });
    const evt2 = new Event('drop', { bubbles: true, cancelable: true }) as any;
    evt2.dataTransfer = { getData: () => 'f.txt' };
    folderLi.dispatchEvent(evt2);

    // simulate failed login catch path
    (global.fetch as jest.Mock).mockImplementationOnce(async () => ({
      ok: false,
    }));
    (window as any).alert = jest.fn();
    (document.getElementById('loginBtn') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));

    // logout flows
    (document.getElementById('logoutBtn') as HTMLButtonElement).click();

    // trigger load catch by making tree fetch fail, clicking folder link
    (global.fetch as jest.Mock).mockImplementationOnce(async (url: string) => ({
      ok: url.startsWith('/api/tree') ? false : true,
      json: async () => ({}),
    }));
    const folderLink = document.querySelector('#tree a') as HTMLAnchorElement;
    folderLink.click();
    // trigger drop with no from to hit if (!from) return
    const evt3 = new Event('drop', { bubbles: true, cancelable: true }) as any;
    evt3.dataTransfer = { getData: () => '' };
    folderLi.dispatchEvent(evt3);
  });
});
