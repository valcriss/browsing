/* Minimal logger wrapper */
export const logger = {
  info: (...args: unknown[]): void => {
    // eslint-disable-next-line no-console
    console.log('[INFO]', ...args);
  },
  warn: (...args: unknown[]): void => {
    // eslint-disable-next-line no-console
    console.warn('[WARN]', ...args);
  },
  error: (...args: unknown[]): void => {
    // eslint-disable-next-line no-console
    console.error('[ERROR]', ...args);
  },
};

export default logger;
