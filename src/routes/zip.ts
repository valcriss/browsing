import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { bearerFromHeaderOrQuery } from '../auth/bearer';
import { resolveSafePath } from '../fs/pathSafe';
import logger from '../utils/logger';

const router = Router();

router.get('/api/zip', bearerFromHeaderOrQuery, async (req, res) => {
  try {
    const rel = String(req.query.path ?? '');
    const abs = await resolveSafePath(rel);
    const st = await fs.promises.stat(abs);
    if (!st.isDirectory()) {
      const err: Error & { status?: number } = new Error('Not a directory');
      err.status = 400;
      throw err;
    }
    const name = path.basename(abs);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${name}.zip"`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', () => res.status(500).end());
    archive.pipe(res);
    archive.directory(abs, false);
    archive.finalize();
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    const status = err?.status ?? 500;
    logger.warn('GET /api/zip failed', { status, message: err?.message });
    res.status(status).json({ error: err?.message || 'Error' });
  }
});

export default router;
/* istanbul ignore file */
