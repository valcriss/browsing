import { Router } from 'express';
import logger from '../utils/logger';
import { bearerRequired } from '../auth/bearer';
import { list } from '../fs/fileOps';

const router = Router();

router.get('/api/tree', bearerRequired, async (req, res) => {
  try {
    const rel = String(req.query.path ?? '.');
    const result = await list(rel);
    res.json({ ...result, user: req.user });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    const status = err?.status ?? 500;
    logger.warn('GET /api/tree failed', { status, message: err?.message });
    res.status(status).json({ error: err?.message || 'Error' });
  }
});

export default router;
/* istanbul ignore file */
