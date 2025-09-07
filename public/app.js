const THEME_KEY = 'theme';
function getStorage() {
    return globalThis.localStorage;
}
export function getTheme() {
    const storage = getStorage();
    const raw = storage?.getItem(THEME_KEY);
    if (raw === 'dark' || raw === 'light' || raw === 'system')
        return raw;
    return 'system';
}
export function setTheme(theme) {
    const storage = getStorage();
    storage?.setItem(THEME_KEY, theme);
    applyTheme();
}
function prefersDark() {
    return globalThis.matchMedia
        ? globalThis.matchMedia('(prefers-color-scheme: dark)').matches
        : false;
}
export function applyTheme() {
    const theme = getTheme();
    const root = document?.documentElement;
    if (!root)
        return;
    const useDark = theme === 'dark' || (theme === 'system' && prefersDark());
    root.classList.toggle('dark', useDark);
    const btn = document.getElementById('themeToggle');
    if (btn)
        btn.textContent = `Theme: ${theme.charAt(0).toUpperCase()}${theme.slice(1)}`;
}
export function getSession() {
    const storage = globalThis
        .sessionStorage;
    const raw = storage?.getItem('session');
    if (!raw)
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export function setSession(sess) {
    const storage = globalThis
        .sessionStorage;
    if (!storage)
        return;
    if (sess)
        storage.setItem('session', JSON.stringify(sess));
    else
        storage.removeItem('session');
}
export function authHeader() {
    const sess = getSession();
    return sess ? { Authorization: `Bearer ${sess.token}` } : {};
}
export async function login(username, password) {
    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    if (!res.ok)
        throw new Error('Login failed');
    const data = (await res.json());
    setSession(data);
    return data;
}
export function isAdmin() {
    return getSession()?.user.role === 'admin';
}
/* istanbul ignore next */
async function fetchTree(rel = '.') {
    const res = await fetch(`/api/tree?path=${encodeURIComponent(rel)}`, {
        headers: { ...authHeader() },
    });
    if (!res.ok) {
        let msg = 'Failed to load';
        try {
            const body = (await res.json());
            if (body && body.error)
                msg = body.error;
        }
        catch {
            // ignore parse error
        }
        throw new Error(msg);
    }
    return res.json();
}
/* istanbul ignore next */
function render(tree) {
    const roleBadge = document.getElementById('roleBadge');
    /* istanbul ignore next */ roleBadge.textContent = tree.user
        ? `${tree.user.username} (${tree.user.role})`
        : '';
    const breadcrumb = document.getElementById('breadcrumb');
    breadcrumb.textContent = `Path: ${tree.cwd}`;
    const treeEl = document.getElementById('tree');
    const list = document.getElementById('list');
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
            load(tree.parent);
        });
        li.appendChild(a);
        li.classList.add('droppable');
        li.addEventListener('dragover', (e) => e.preventDefault());
        li.addEventListener('drop', async (e) => {
            e.preventDefault();
            const from = e.dataTransfer?.getData('text/plain');
            if (!from)
                return;
            const base = tree.parent === '.' ? '' : tree.parent;
            const dest = `${base}${base ? '/' : ''}${from.split('/').pop()}`;
            try {
                await fetch('/api/move', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeader() },
                    body: JSON.stringify({ from, to: dest }),
                });
                await load(tree.cwd);
            }
            catch {
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
            a.addEventListener('click', async (e) => {
                e.preventDefault();
                load(`${tree.cwd}/${it.name}`);
            });
            li.appendChild(a);
            li.classList.add('droppable');
            li.addEventListener('dragover', (e) => e.preventDefault());
            li.addEventListener('drop', async (e) => {
                e.preventDefault();
                const from = e.dataTransfer?.getData('text/plain');
                if (!from)
                    return;
                try {
                    await fetch('/api/move', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...authHeader() },
                        body: JSON.stringify({
                            from,
                            to: `${tree.cwd}/${it.name}/${from.split('/').pop()}`,
                        }),
                    });
                    await load(tree.cwd);
                }
                catch {
                    alert('Move failed');
                }
            });
            treeEl.appendChild(li);
        }
        else {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center py-1';
            const a = document.createElement('a');
            a.textContent = '📄 ' + it.name;
            a.draggable = true;
            a.addEventListener('dragstart', (e) => e.dataTransfer?.setData('text/plain', `${tree.cwd}/${it.name}`));
            const sess = getSession();
            const dlHref = `/api/file?path=${encodeURIComponent(tree.cwd + '/' + it.name)}${sess ? `&token=${encodeURIComponent(sess.token)}` : ''}`;
            a.href = dlHref;
            a.setAttribute('download', it.name);
            li.appendChild(a);
            if (isAdmin()) {
                const del = document.createElement('button');
                del.textContent = '🗑️';
                del.className = 'ml-2 text-red-600';
                del.addEventListener('click', async () => {
                    await fetch(`/api/file?path=${encodeURIComponent(tree.cwd + '/' + it.name)}`, { method: 'DELETE', headers: authHeader() });
                    await load(tree.cwd);
                });
                li.appendChild(del);
            }
            list.appendChild(li);
        }
    }
}
async function load(rel = '.') {
    const loader = document.getElementById('loader');
    const breadcrumb = document.getElementById('breadcrumb');
    loader?.classList.remove('hidden');
    try {
        const data = await fetchTree(rel);
        render(data);
    }
    catch (e) {
        const msg = e?.message || 'Failed to load';
        if (breadcrumb)
            breadcrumb.textContent = msg;
    }
    finally {
        loader?.classList.add('hidden');
    }
}
/* istanbul ignore next */
function init() {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
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
        const next = current === 'system' ? 'dark' : current === 'dark' ? 'light' : 'system';
        setTheme(next);
    });
    // apply theme on load and update if system preference changes
    applyTheme();
    if (globalThis.matchMedia) {
        const mq = globalThis.matchMedia('(prefers-color-scheme: dark)');
        const onChange = (e) => {
            void e;
            if (getTheme() === 'system')
                applyTheme();
        };
        // Safari uses addListener/removeListener
        if (typeof mq.addEventListener === 'function') {
            mq.addEventListener('change', onChange);
        }
        else if (typeof mq.addListener === 'function') {
            mq.addListener(onChange);
        }
    }
    loginBtn?.addEventListener('click', async () => {
        const u = document.getElementById('username').value;
        const p = document.getElementById('password').value;
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
        }
        catch {
            if (loginError) {
                loginError.textContent = 'Invalid credentials';
                loginError.classList.remove('hidden');
            }
        }
        finally {
            loader?.classList.add('hidden');
        }
    });
    logoutBtn?.addEventListener('click', () => {
        setSession(null);
        showLogin();
        const list = document.getElementById('list');
        if (list)
            list.innerHTML = '';
        const crumb = document.getElementById('breadcrumb');
        if (crumb)
            crumb.textContent = '';
    });
    if (getSession()) {
        showApp();
        void load('.');
    }
    else {
        showLogin();
    }
}
if (typeof document !== 'undefined') {
    init();
}
// helper for tests
export function extractDragPath(dt) {
    return dt.getData('text/plain');
}
/* istanbul ignore file */
