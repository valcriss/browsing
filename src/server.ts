import express from 'express';
import path from 'path';
import treeRouter from './routes/tree';
import fileRouter from './routes/file';
import zipRouter from './routes/zip';
import adminRouter from './routes/admin';
import { loginHandler } from './auth/login';
import logger from './utils/logger';

export const app = express();
app.use(express.json());

app.post('/api/login', loginHandler);
app.use(treeRouter);
app.use(fileRouter);
app.use(zipRouter);
app.use(adminRouter);

// static frontend
const publicDir = path.resolve(process.cwd(), 'public');
app.use(express.static(publicDir));

// global error guard
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction, // eslint-disable-line @typescript-eslint/no-unused-vars
  ) => {
    const hasMsg =
      typeof err === 'object' &&
      err !== null &&
      'message' in (err as { message?: string });
    const msg = hasMsg ? (err as { message?: string }).message : String(err);
    logger.error('Unhandled', msg);
    res.status(500).json({ error: 'Internal error' });
  },
);

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => logger.info(`Server listening on :${port}`));
}

export default app;
