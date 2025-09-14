type Role = 'admin' | 'user';
interface User {
  username: string;
  role: Role;
}
interface Session {
  token: string;
  user: User;
}
interface TreeItem {
  name: string;
  isDir: boolean;
  size: number | null;
  mtime: string;
}
interface TreeResponse {
  cwd: string;
  parent: string | null;
  items: TreeItem[];
  user: User;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, v: string): void;
  removeItem(key: string): void;
}

type Theme = 'system' | 'dark' | 'light';
const THEME_KEY = 'theme';

function getStorage(): StorageLike | undefined {
  return (globalThis as unknown as { localStorage?: StorageLike }).localStorage;
}

export function getTheme(): Theme {
  const storage = getStorage();
  const raw = storage?.getItem(THEME_KEY);
  if (raw === 'dark' || raw === 'light' || raw === 'system') return raw;
  return 'system';
}

export function setTheme(theme: Theme): void {
  const storage = getStorage();
  storage?.setItem(THEME_KEY, theme);
  applyTheme();
}

function prefersDark(): boolean {
  return globalThis.matchMedia
    ? globalThis.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

export function applyTheme(): void {
  const theme = getTheme();
  const root = document?.documentElement;
  if (!root) return;
  const useDark = theme === 'dark' || (theme === 'system' && prefersDark());
  root.classList.toggle('dark', useDark);
  const btn = document.getElementById('themeToggle');
  if (btn)
    btn.textContent = `Theme: ${theme.charAt(0).toUpperCase()}${theme.slice(1)}`;
}

export function getSession(): Session | null {
  const storage = (globalThis as unknown as { sessionStorage?: StorageLike })
    .sessionStorage;
  const raw = storage?.getItem('session');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function setSession(sess: Session | null): void {
  const storage = (globalThis as unknown as { sessionStorage?: StorageLike })
    .sessionStorage;
  if (!storage) return;
  if (sess) storage.setItem('session', JSON.stringify(sess));
  else storage.removeItem('session');
}

export function authHeader(): Record<string, string> {
  const sess = getSession();
  return sess ? { Authorization: `Bearer ${sess.token}` } : {};
}

export async function login(
  username: string,
  password: string,
): Promise<Session> {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error('Login failed');
  const data = (await res.json()) as Session;
  setSession(data);
  return data;
}

export function isAdmin(): boolean {
  return getSession()?.user.role === 'admin';
}

/* istanbul ignore next */
async function fetchTree(rel = '.'): Promise<TreeResponse> {
  const res = await fetch(`/api/tree?path=${encodeURIComponent(rel)}`, {
    headers: { ...authHeader() },
  });
  if (!res.ok) {
    let msg = 'Failed to load';
    try {
      const body = (await res.json()) as { error?: string };
      if (body && body.error) msg = body.error;
    } catch {
      // ignore parse error
    }
    throw new Error(msg);
  }
  return res.json() as Promise<TreeResponse>;
}

async function downloadDir(relPath: string): Promise<void> {
  const dlg = document.getElementById('zipModal');
  dlg?.classList.remove('hidden');
  try {
    const res = await fetch(`/api/zip?path=${encodeURIComponent(relPath)}`, {
      headers: { ...authHeader() },
    });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${relPath.split('/').pop() || 'archive'}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } finally {
    dlg?.classList.add('hidden');
  }
}

/* istanbul ignore next */
function render(tree: TreeResponse): void {
  const roleBadge = document.getElementById('roleBadge')!;
  /* istanbul ignore next */ roleBadge.textContent = tree.user
    ? `${tree.user.username} (${tree.user.role})`
    : '';
  const breadcrumb = document.getElementById('breadcrumb')!;
  breadcrumb.textContent = `Path: ${tree.cwd}`;

  const treeEl = document.getElementById('tree')!;
  const list = document.getElementById('list')!;
  treeEl.innerHTML = '';
  list.innerHTML = '';

  // Up one level link when not at root
  if (tree.parent) {
    const li = document.createElement('li');
    li.className = 'flex justify-between items-center py-1';
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = '⬆️ ..';
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      load(tree.parent!);
    });
    li.appendChild(a);
    li.classList.add('droppable');
    li.addEventListener('dragover', (e) => e.preventDefault());
    li.addEventListener('drop', async (e) => {
      e.preventDefault();
      const from = e.dataTransfer?.getData('text/plain');
      if (!from) return;
      const base = tree.parent === '.' ? '' : tree.parent;
      const dest = `${base}${base ? '/' : ''}${from.split('/').pop()}`;
      try {
        await fetch('/api/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify({ from, to: dest }),
        });
        await load(tree.cwd);
      } catch {
        alert('Move failed');
      }
    });
    treeEl.appendChild(li);
  }

  for (const it of tree.items) {
    if (it.isDir) {
      const li = document.createElement('li');
      li.className = 'flex justify-between items-center py-1';
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = '📁 ' + it.name;
      a.draggable = true;
      a.addEventListener('dragstart', (e) =>
        e.dataTransfer?.setData('text/plain', `${tree.cwd}/${it.name}`),
      );
      a.addEventListener('click', async (e) => {
        e.preventDefault();
        load(`${tree.cwd}/${it.name}`);
      });
      li.appendChild(a);
      const dl = document.createElement('button');
      dl.textContent = '⬇️';
      dl.className = 'ml-2';
      dl.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await downloadDir(`${tree.cwd}/${it.name}`);
      });
      li.appendChild(dl);
      li.classList.add('droppable');
      li.addEventListener('dragover', (e) => e.preventDefault());
      li.addEventListener('drop', async (e) => {
        e.preventDefault();
        const from = e.dataTransfer?.getData('text/plain');
        if (!from) return;
        const destDir = `${tree.cwd}/${it.name}`;
        if (from === destDir || destDir.startsWith(from + '/')) {
          return;
        }
        try {
          await fetch('/api/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify({
              from,
              to: `${destDir}/${from.split('/').pop()}`,
            }),
          });
          await load(tree.cwd);
        } catch {
          alert('Move failed');
        }
      });
      treeEl.appendChild(li);
    } else {
      const li = document.createElement('li');
      li.className = 'flex justify-between items-center py-1';
      const a = document.createElement('a');
      a.textContent = '📄 ' + it.name;
      a.draggable = true;
      a.addEventListener('dragstart', (e) =>
        e.dataTransfer?.setData('text/plain', `${tree.cwd}/${it.name}`),
      );
      const sess = getSession();
      const dlHref = `/api/file?path=${encodeURIComponent(
        tree.cwd + '/' + it.name,
      )}${sess ? `&token=${encodeURIComponent(sess.token)}` : ''}`;
      a.href = dlHref;
      a.setAttribute('download', it.name);
      li.appendChild(a);
      if (isAdmin()) {
        const del = document.createElement('button');
        del.textContent = '🗑️';
        del.className = 'ml-2 text-red-600';
        del.addEventListener('click', async () => {
          await fetch(
            `/api/file?path=${encodeURIComponent(tree.cwd + '/' + it.name)}`,
            { method: 'DELETE', headers: authHeader() },
          );
          await load(tree.cwd);
        });
        li.appendChild(del);
      }
      list.appendChild(li);
    }
  }
}

async function load(rel = '.'): Promise<void> {
  const loader = document.getElementById('loader');
  const breadcrumb = document.getElementById('breadcrumb');
  loader?.classList.remove('hidden');
  try {
    const data = await fetchTree(rel);
    render(data);
  } catch (e) {
    const msg = (e as Error)?.message || 'Failed to load';
    if (breadcrumb) breadcrumb.textContent = msg;
  } finally {
    loader?.classList.add('hidden');
  }
}

/* istanbul ignore next */
function init(): void {
  const loginBtn = document.getElementById(
    'loginBtn',
  ) as HTMLButtonElement | null;
  const logoutBtn = document.getElementById(
    'logoutBtn',
  ) as HTMLButtonElement | null;
  const loginPanel = document.getElementById('loginPanel');
  const appPanel = document.getElementById('appPanel');
  const showLogin = () => {
    loginPanel?.classList.remove('hidden');
    appPanel?.classList.add('hidden');
  };
  const showApp = () => {
    appPanel?.classList.remove('hidden');
    loginPanel?.classList.add('hidden');
  };

  // theme toggle
  const themeBtn = document.getElementById('themeToggle');
  themeBtn?.addEventListener('click', () => {
    const current = getTheme();
    const next: Theme =
      current === 'system' ? 'dark' : current === 'dark' ? 'light' : 'system';
    setTheme(next);
  });
  // apply theme on load and update if system preference changes
  applyTheme();
  if (globalThis.matchMedia) {
    const mq = globalThis.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      void e;
      if (getTheme() === 'system') applyTheme();
    };
    // Safari uses addListener/removeListener
    if (typeof (mq as MediaQueryList).addEventListener === 'function') {
      (mq as MediaQueryList).addEventListener('change', onChange);
    } else if (typeof (mq as MediaQueryList).addListener === 'function') {
      (mq as MediaQueryList).addListener(onChange);
    }
  }

  loginBtn?.addEventListener('click', async () => {
    const u = (document.getElementById('username') as HTMLInputElement).value;
    const p = (document.getElementById('password') as HTMLInputElement).value;
    const loginError = document.getElementById('loginError');
    const loader = document.getElementById('loader');
    if (loginError) {
      loginError.textContent = '';
      loginError.classList.add('hidden');
    }
    try {
      loader?.classList.remove('hidden');
      await login(u, p);
      showApp();
      await load('.');
    } catch {
      if (loginError) {
        loginError.textContent = 'Invalid credentials';
        loginError.classList.remove('hidden');
      }
    } finally {
      loader?.classList.add('hidden');
    }
  });
  logoutBtn?.addEventListener('click', () => {
    setSession(null);
    showLogin();
    const list = document.getElementById('list');
    if (list) list.innerHTML = '';
    const crumb = document.getElementById('breadcrumb');
    if (crumb) crumb.textContent = '';
  });

  if (getSession()) {
    showApp();
    void load('.');
  } else {
    showLogin();
  }
}

if (typeof document !== 'undefined') {
  init();
}

// helper for tests
export function extractDragPath(dt: {
  getData: (t: string) => string | null;
}): string | null {
  return dt.getData('text/plain');
}
/* istanbul ignore file */
