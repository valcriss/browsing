import { Router } from 'express';
import fs from 'fs';
import { bearerRequired } from '../auth/bearer';
import { getFileMeta } from '../fs/fileOps';
import logger from '../utils/logger';

const router = Router();

router.get('/api/file', bearerRequired, async (req, res) => {
  try {
    const rel = String(req.query.path ?? '');
    const meta = await getFileMeta(rel);
    res.setHeader('Content-Type', meta.mimeType);
    res.setHeader('Content-Length', String(meta.size));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${meta.filename}"`,
    );
    const stream = fs.createReadStream(meta.abs);
    stream.on('error', () => res.status(500).end());
    stream.pipe(res);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    const status = err?.status ?? 500;
    logger.warn('GET /api/file failed', { status, message: err?.message });
    res.status(status).json({ error: err?.message || 'Error' });
  }
});

export default router;
/* istanbul ignore file */
