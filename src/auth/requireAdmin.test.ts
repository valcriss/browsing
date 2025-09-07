import { requireAdmin } from './bearer';

function fakeRes() {
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  return res as { status: (n: number) => any; json: (o: unknown) => any };
}

describe('requireAdmin', () => {
  it('returns 401 when no user', () => {
    const res = fakeRes();
    const next = jest.fn();
    requireAdmin({} as any, res as any, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when role is user', () => {
    const res = fakeRes();
    const next = jest.fn();
    requireAdmin(
      { user: { username: 'a', role: 'user' } } as any,
      res as any,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when admin', () => {
    const res = fakeRes();
    const next = jest.fn();
    requireAdmin(
      { user: { username: 'a', role: 'admin' } } as any,
      res as any,
      next,
    );
    expect(next).toHaveBeenCalled();
  });
});
