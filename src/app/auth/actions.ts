'use server';
import { redirect, unstable_rethrow } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { appUrl } from '@/lib/config';
import {
  loginSchema,
  registerSchema,
  email,
  password,
  errorMessage,
  type ActionResult,
} from '@/lib/validation';
import { requireUser } from '@/lib/auth';
export async function authenticate(mode: string, values: unknown): Promise<ActionResult> {
  try {
    const db = await createClient();
    if (mode === 'login') {
      const parsed = loginSchema.safeParse(values);
      if (!parsed.success) return { error: 'Enter a valid email and password.' };
      const { error } = await db.auth.signInWithPassword(parsed.data);
      if (error)
        return {
          error: 'Sign-in failed. Check your credentials, verify your email, or try again later.',
        };
    } else if (mode === 'register') {
      const parsed = registerSchema.safeParse(values);
      if (!parsed.success) return { error: parsed.error.issues[0].message };
      const { data, error } = await db.auth.signUp({
        ...parsed.data,
        options: { emailRedirectTo: `${appUrl()}/auth/callback` },
      });
      if (error)
        return {
          error: 'Registration failed. Please try again later or contact your administrator.',
        };
      if (!data.session)
        return {
          success:
            'Check your email for a verification link. If you already have an account, sign in or reset your password.',
        };
    } else if (mode === 'reset') {
      const parsed = email.safeParse((values as { email?: unknown })?.email);
      if (!parsed.success) return { error: 'Enter a valid email.' };
      const { error } = await db.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${appUrl()}/auth/callback?next=/update-password`,
      });
      if (error) return { error: 'Password reset could not be requested. Please try again later.' };
      return {
        success:
          'If an account exists for this email, a password-reset link has been requested. Check your inbox.',
      };
    } else if (mode === 'update') {
      await requireUser();
      const parsed = password.safeParse((values as { password?: unknown })?.password);
      if (!parsed.success) return { error: parsed.error.issues[0].message };
      const { error } = await db.auth.updateUser({ password: parsed.data });
      if (error)
        return { error: 'Password update failed. Request a new reset link and try again.' };
      return { success: 'Your password was updated.' };
    } else return { error: 'Unsupported authentication operation.' };
  } catch (error) {
    unstable_rethrow(error);
    return { error: errorMessage(error) };
  }
  redirect('/app');
}
export async function logout(): Promise<ActionResult> {
  try {
    const db = await createClient();
    const { error } = await db.auth.signOut();
    if (error) return { error: 'Logout failed. Please try again.' };
  } catch (error) {
    unstable_rethrow(error);
    return { error: errorMessage(error) };
  }
  redirect('/login');
}
