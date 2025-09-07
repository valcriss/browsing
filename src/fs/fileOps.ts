import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import { resolveSafePath, toRelative } from './pathSafe';

export interface TreeItem {
  name: string;
  isDir: boolean;
  size: number | null;
  mtime: string;
}

type HttpError = Error & { status?: number };

export async function list(
  relDir: string,
): Promise<{ cwd: string; parent: string | null; items: TreeItem[] }> {
  const dirAbs = resolveSafePath(relDir);
  const stat = await fs.promises.stat(dirAbs);
  if (!stat.isDirectory()) {
    const err: HttpError = new Error('Not a directory');
    err.status = 400;
    throw err;
  }
  const names = await fs.promises.readdir(dirAbs);
  const items: TreeItem[] = [];
  for (const name of names) {
    // filter dotfiles/directories (hidden entries)
    if (name.startsWith('.')) continue;
    const abs = path.join(dirAbs, name);
    try {
      // Use lstat to avoid failing on broken symlinks; try to resolve type when possible
      const ls = await fs.promises.lstat(abs);
      let isDir = ls.isDirectory();
      let size: number | null = isDir ? null : ls.size;
      let mtime = ls.mtime.toISOString();
      if (ls.isSymbolicLink()) {
        try {
          const ts = await fs.promises.stat(abs);
          isDir = ts.isDirectory();
          size = ts.isDirectory() ? null : ts.size;
          mtime = ts.mtime.toISOString();
        } catch {
          // Broken link: treat as non-dir with null size
          isDir = false;
          size = null;
        }
      }
      items.push({ name, isDir, size, mtime });
    } catch {
      // Skip entries that disappear or are unreadable
      continue;
    }
  }
  // sort: dirs first then files alpha
  items.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const cwd = toRelative(dirAbs);
  const parentRel = path.dirname(cwd);
  const parent = cwd === '.' ? null : parentRel;
  return { cwd, parent, items };
}

export async function getFileMeta(
  relFile: string,
): Promise<{ abs: string; size: number; mimeType: string; filename: string }> {
  const abs = resolveSafePath(relFile);
  const st = await fs.promises.stat(abs);
  if (st.isDirectory()) {
    const err: HttpError = new Error('Is a directory');
    err.status = 400;
    throw err;
  }
  const filename = path.basename(abs);
  const mimeType = (mime.lookup(filename) ||
    'application/octet-stream') as string;
  return { abs, size: st.size, mimeType, filename };
}

export async function move(fromRel: string, toRel: string): Promise<void> {
  const fromAbs = resolveSafePath(fromRel);
  const toAbs = resolveSafePath(toRel);
  await fs.promises.mkdir(path.dirname(toAbs), { recursive: true });
  await fs.promises.rename(fromAbs, toAbs);
}

export async function remove(relPath: string): Promise<void> {
  const abs = resolveSafePath(relPath);
  await fs.promises.rm(abs, { recursive: true, force: true });
}
/* istanbul ignore file */
