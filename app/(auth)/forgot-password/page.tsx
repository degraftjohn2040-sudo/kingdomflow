import { ForgotPasswordForm } from "@/components/auth-forms";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Reset your password</h1>
      <p className="mb-6 mt-1 text-sm text-ink-500">
        Enter the email address on your account and we will send a secure reset link.
      </p>
      <ForgotPasswordForm />
    </div>
  );
}
