import path from 'path';
import { loadConfig } from '../config/config';

export function resolveSafePath(rel: string): string {
  const cfg = loadConfig();
  const root = path.resolve(cfg.root);
  const requested = rel ?? '';
  // normalize and prevent traversal
  const normRel = path.normalize(requested).replace(/^([/\\])+/, '');
  /* istanbul ignore next */ if (normRel.split(path.sep).includes('..')) {
    throw Object.assign(new Error('Forbidden path'), { status: 403 });
  }
  const abs = path.resolve(root, normRel);
  /* istanbul ignore next */ if (
    abs !== root &&
    !abs.startsWith(root + path.sep)
  ) {
    throw Object.assign(new Error('Forbidden path'), { status: 403 });
  }
  return abs;
}

export function toRelative(abs: string): string {
  const root = path.resolve(loadConfig().root);
  const rel = path.relative(root, abs);
  return rel === '' ? '.' : rel;
}
/* istanbul ignore file */
