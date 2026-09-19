import { beforeEach, describe, it, expect, vi } from 'vitest';
// Unit-test doubles only. These do not verify real Supabase sessions/email delivery.
const state = vi.hoisted(() => ({
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
  },
  redirect: vi.fn(),
  requireUser: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: state.auth }) }));
vi.mock('@/lib/auth', () => ({ requireUser: state.requireUser }));
vi.mock('next/navigation', () => ({ redirect: state.redirect, unstable_rethrow: () => {} }));
import { authenticate, logout } from '../src/app/auth/actions';
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://kingdomflow.example');
  state.requireUser.mockResolvedValue({ user: { id: 'server-derived' } });
});
describe('authentication provider boundary (unit)', () => {
  it('validates registration before contacting Supabase', async () => {
    expect(
      (await authenticate('register', { email: 'bad', password: 'short' })).error,
    ).toBeTruthy();
    expect(state.auth.signUp).not.toHaveBeenCalled();
  });
  it('requires provider-accepted registration and reports confirmation when no session exists', async () => {
    state.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const result = await authenticate('register', {
      email: 'owner@example.org',
      password: 'long-unique-password',
    });
    expect(result.success).toContain('Check your email');
    expect(state.redirect).not.toHaveBeenCalled();
    expect(state.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { emailRedirectTo: 'https://kingdomflow.example/auth/callback' },
      }),
    );
  });
  it('does not redirect after failed login', async () => {
    state.auth.signInWithPassword.mockResolvedValue({ error: { message: 'Rejected' } });
    expect(
      (await authenticate('login', { email: 'x@example.org', password: 'password' })).error,
    ).toBeTruthy();
    expect(state.redirect).not.toHaveBeenCalled();
  });
  it('redirects to protected workspace only after provider acceptance', async () => {
    state.auth.signInWithPassword.mockResolvedValue({ error: null });
    await authenticate('login', { email: 'x@example.org', password: 'password' });
    expect(state.redirect).toHaveBeenCalledWith('/app');
  });
  it('terminates the real provider session before redirecting', async () => {
    state.auth.signOut.mockResolvedValue({ error: null });
    await logout();
    expect(state.auth.signOut).toHaveBeenCalledTimes(1);
    expect(state.redirect).toHaveBeenCalledWith('/login');
  });
  it('never claims logout when provider fails', async () => {
    state.auth.signOut.mockResolvedValue({ error: { message: 'Unavailable' } });
    expect((await logout()).error).toContain('Logout failed');
    expect(state.redirect).not.toHaveBeenCalled();
  });
  it('surfaces reset failure instead of claiming email sent', async () => {
    state.auth.resetPasswordForEmail.mockResolvedValue({ error: { message: 'Unavailable' } });
    const result = await authenticate('reset', { email: 'x@example.org' });
    expect(result.error).toBeTruthy();
    expect(result.success).toBeUndefined();
  });
  it('requires authenticated identity to update passwords', async () => {
    state.requireUser.mockRejectedValue(new Error('Authentication required'));
    expect((await authenticate('update', { password: 'long-unique-password' })).error).toBe(
      'Authentication required',
    );
    expect(state.auth.updateUser).not.toHaveBeenCalled();
  });
  it('uses an enumeraton-safe password reset message', async () => {
    state.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    expect((await authenticate('reset', { email: 'x@example.org' })).success).toContain(
      'If an account exists',
    );
  });
});
