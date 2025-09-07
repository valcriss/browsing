import type { Express } from 'express';

describe('server startup branch', () => {
  const OLD_ENV = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = OLD_ENV;
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('calls listen when not test', async () => {
    const middlewares: any[] = [];
    const listen = jest.fn((_port: number, cb: () => void) => {
      cb();
      return {} as any;
    });
    const use = jest.fn((fn: any) => {
      middlewares.push(fn);
    });
    const post = jest.fn();
    const fakeApp = { use, post, listen } as unknown as Express;
    jest.doMock('express', () => {
      const fn: any = () => fakeApp;
      fn.static = () => (_req: any, _res: any, next: any) => next();
      fn.json = () => (_req: any, _res: any, next: any) => next();
      fn.Router = () => ({
        get: jest.fn(),
        post: jest.fn(),
        use: jest.fn(),
        delete: jest.fn(),
      });
      return fn;
    });
    process.env.NODE_ENV = 'production';
    await import('./server');
    expect(listen).toHaveBeenCalled();
    // invoke the error middleware and assert it responds 500
    const errMw = middlewares.find((fn) => fn.length === 4);
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    errMw(new Error('boom'), {} as any, { status, json } as any, jest.fn());
    expect(status).toHaveBeenCalledWith(500);
  });

  it('does not listen in test env', async () => {
    jest.resetModules();
    const listen = jest.fn();
    const use = jest.fn();
    const post = jest.fn();
    const fakeApp = { use, post, listen } as unknown as any;
    jest.doMock('express', () => {
      const fn: any = () => fakeApp;
      fn.static = () => (_req: any, _res: any, next: any) => next();
      fn.json = () => (_req: any, _res: any, next: any) => next();
      fn.Router = () => ({
        get: jest.fn(),
        post: jest.fn(),
        use: jest.fn(),
        delete: jest.fn(),
      });
      return fn;
    });
    process.env.NODE_ENV = 'test';
    await import('./server');
    expect(listen).not.toHaveBeenCalled();
  });

  it('error middleware handles non-object error', async () => {
    const listen = jest.fn((_port: number, cb: () => void) => {
      cb();
      return {} as any;
    });
    const uses: any[] = [];
    const use = jest.fn((fn: any) => uses.push(fn));
    const fakeApp = { use, post: jest.fn(), listen } as any;
    jest.doMock('express', () => {
      const fn: any = () => fakeApp;
      fn.static = () => (_req: any, _res: any, next: any) => next();
      fn.json = () => (_req: any, _res: any, next: any) => next();
      fn.Router = () => ({
        get: jest.fn(),
        post: jest.fn(),
        use: jest.fn(),
        delete: jest.fn(),
      });
      return fn;
    });
    process.env.NODE_ENV = 'production';
    await import('./server');
    const errMw = uses.find((fn) => fn.length === 4);
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    errMw('string error', {} as any, { status, json } as any, jest.fn());
    expect(status).toHaveBeenCalledWith(500);
  });
});
