import { Router } from 'express';
import { bearerRequired, requireAdmin } from '../auth/bearer';
import { move, remove } from '../fs/fileOps';
import logger from '../utils/logger';

const router = Router();

router.post('/api/move', bearerRequired, requireAdmin, async (req, res) => {
  try {
    const { from, to } = req.body ?? {};
    if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
      return res.status(400).json({ error: 'Missing fields' });
    }
    await move(from, to);
    res.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    const status = err?.status ?? 500;
    logger.warn('POST /api/move failed', { status, message: err?.message });
    res.status(status).json({ error: err?.message || 'Error' });
  }
});

router.delete('/api/file', bearerRequired, requireAdmin, async (req, res) => {
  try {
    const rel = String(req.query.path ?? '');
    if (!rel) return res.status(400).json({ error: 'Missing path' });
    await remove(rel);
    res.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    const status = err?.status ?? 500;
    logger.warn('DELETE /api/file failed', { status, message: err?.message });
    res.status(status).json({ error: err?.message || 'Error' });
  }
});

export default router;
/* istanbul ignore file */
