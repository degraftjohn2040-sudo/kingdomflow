'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { authenticate } from '@/app/auth/actions';
import { Button } from '@/components/ui/button';
import { email, password, type ActionResult } from '@/lib/validation';
type Values = { email: string | undefined; password: string | undefined };
export function AuthForm({
  mode,
  configured,
}: {
  mode: 'login' | 'register' | 'reset' | 'update';
  configured: boolean;
}) {
  const schema = z.object({
    email: mode === 'update' ? z.string().optional() : email,
    password:
      mode === 'reset'
        ? z.string().optional()
        : mode === 'login'
          ? z.string().min(1).max(128)
          : password,
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });
  const [result, setResult] = useState<ActionResult>({});
  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        setResult({});
        try {
          setResult(await authenticate(mode, values));
        } catch {
          setResult({ error: 'Network error. Please try again.' });
        }
      })}
      className="form-stack"
    >
      {!configured && (
        <div className="notice warning" role="status">
          <strong>Configuration Required</strong>
          <br />
          Supabase authentication is not connected.{' '}
          <Link href="/configuration">View setup requirements</Link>.
        </div>
      )}
      {mode !== 'update' && (
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email && <small className="error">{errors.email.message}</small>}
        </div>
      )}
      {(mode === 'login' || mode === 'register' || mode === 'update') && (
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            {...register('password')}
            aria-invalid={Boolean(errors.password)}
          />
          {mode !== 'login' && <small>Use at least 12 characters.</small>}
          {errors.password && <small className="error">{errors.password.message}</small>}
        </div>
      )}
      {result.error && (
        <div role="alert" className="notice danger">
          {result.error}
        </div>
      )}
      {result.success && (
        <div role="status" className="notice success">
          {result.success}
        </div>
      )}
      <Button disabled={isSubmitting || !configured} type="submit">
        {isSubmitting
          ? 'Please wait…'
          : mode === 'login'
            ? 'Sign in'
            : mode === 'register'
              ? 'Create account'
              : mode === 'reset'
                ? 'Send reset link'
                : 'Update password'}
      </Button>
      {mode === 'login' && (
        <>
          <Link className="text-link" href="/reset-password">
            Forgot your password?
          </Link>
          <p className="muted">
            New to KingdomFlow? <Link href="/register">Create an account</Link>
          </p>
        </>
      )}
      {mode === 'register' && (
        <p className="muted">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      )}
      {(mode === 'reset' || mode === 'update') && (
        <Link href={mode === 'update' ? '/app' : '/login'} className="text-link">
          {mode === 'update' ? 'Go to workspace' : 'Back to sign in'}
        </Link>
      )}
    </form>
  );
}
