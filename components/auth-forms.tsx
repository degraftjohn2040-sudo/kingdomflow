"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  requestPasswordReset, resendVerification, signIn, signUp, updatePassword,
} from "@/app/actions/auth";
import type { ActionState } from "@/lib/errors";

function FormError({ state }: { state: ActionState }) {
  if (!state?.message || state.ok) return null;
  return <Alert tone="danger">{state.message}</Alert>;
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, null);
  return (
    <form action={action} className="space-y-4">
      <FormError state={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email address" htmlFor="email" error={state?.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@church.org" />
      </Field>
      <Field label="Password" htmlFor="password" error={state?.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <div className="flex items-center justify-between text-xs">
        <Link href="/forgot-password" className="font-semibold text-royal-700 hover:underline">
          Forgot password?
        </Link>
        <Link href="/signup" className="text-ink-500 hover:underline">
          Create an account
        </Link>
      </div>
      <SubmitButton className="w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(signUp, null);
  return (
    <form action={action} className="space-y-4">
      <FormError state={state} />
      <Field label="Full name" htmlFor="fullName" error={state?.fieldErrors?.fullName}>
        <Input id="fullName" name="fullName" autoComplete="name" required />
      </Field>
      <Field label="Email address" htmlFor="email" error={state?.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        error={state?.fieldErrors?.password}
        hint="At least 8 characters."
      >
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="Confirm password" htmlFor="confirmPassword" error={state?.fieldErrors?.confirmPassword}>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Creating account…">
        Create account
      </SubmitButton>
      <p className="text-center text-xs text-ink-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-royal-700 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, null);
  return (
    <form action={action} className="space-y-4">
      {state?.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <Field label="Email address" htmlFor="email" error={state?.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Sending…">
        Send reset link
      </SubmitButton>
      <p className="text-center text-xs text-ink-500">
        <Link href="/login" className="hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePassword, null);
  return (
    <form action={action} className="space-y-4">
      <FormError state={state} />
      <Field label="New password" htmlFor="password" error={state?.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword" error={state?.fieldErrors?.confirmPassword}>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>
      <SubmitButton className="w-full">Update password</SubmitButton>
    </form>
  );
}

export function VerifyEmailResend({ email }: { email: string }) {
  const [state, action] = useActionState(resendVerification, null);
  return (
    <form action={action} className="space-y-3">
      {state?.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <input type="hidden" name="email" value={email} />
      <SubmitButton variant="secondary" className="w-full" pendingLabel="Sending…">
        Resend verification email
      </SubmitButton>
    </form>
  );
}
