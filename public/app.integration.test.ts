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
    (global as any).alert = jest.fn();
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
        const p = new URL(url, 'http://x').searchParams.get('path');
        if (!p || p === '.')
          return {
            ok: true,
            json: async () => ({
              cwd: '.',
              parent: null,
              items: [
                {
                  name: 'dir1',
                  isDir: true,
                  size: null,
                  mtime: new Date().toISOString(),
                },
                {
                  name: 'dir2',
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
        if (p === 'dir1' || p === './dir1')
          return {
            ok: true,
            json: async () => ({
              cwd: './dir1',
              parent: '.',
              items: [
                {
                  name: 'sub',
                  isDir: true,
                  size: null,
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

    const treeLis = Array.from(document.querySelectorAll('#tree li'));
    const dir1Li = treeLis.find((li) => li.textContent?.includes('dir1'))!;
    const dir2Li = treeLis.find((li) => li.textContent?.includes('dir2'))!;
    const dir1Link = dir1Li.querySelector('a') as HTMLAnchorElement;

    // simulate drop (move file into dir1)
    const evt = new Event('drop', { bubbles: true, cancelable: true }) as any;
    evt.dataTransfer = { getData: () => './f.txt' };
    dir1Li.dispatchEvent(evt);

    // simulate dragging folder dir1
    const drag = new Event('dragstart') as any;
    const setData = jest.fn();
    drag.dataTransfer = { setData };
    dir1Link.dispatchEvent(drag);
    expect(setData).toHaveBeenCalledWith('text/plain', './dir1');
    // drop folder dir1 into dir2
    const folderDrop = new Event('drop', {
      bubbles: true,
      cancelable: true,
    }) as any;
    folderDrop.dataTransfer = { getData: () => './dir1' };
    dir2Li.dispatchEvent(folderDrop);

    const moveCalls = (global.fetch as jest.Mock).mock.calls.length;
    // drop folder into itself
    const badDrop = new Event('drop', {
      bubbles: true,
      cancelable: true,
    }) as any;
    badDrop.dataTransfer = { getData: () => './dir1' };
    dir1Li.dispatchEvent(badDrop);
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(moveCalls);

    // force move failure to hit catch
    (global.fetch as jest.Mock).mockImplementationOnce(async () => {
      throw new Error('fail');
    });
    const evt2 = new Event('drop', { bubbles: true, cancelable: true }) as any;
    evt2.dataTransfer = { getData: () => './f.txt' };
    dir1Li.dispatchEvent(evt2);

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
    const folderLink2 = document.querySelector('#tree a') as HTMLAnchorElement;
    folderLink2.click();
    // trigger drop with no from to hit if (!from) return
    const evt3 = new Event('drop', { bubbles: true, cancelable: true }) as any;
    evt3.dataTransfer = { getData: () => '' };
    dir1Li.dispatchEvent(evt3);
  });
});
