import { AuthForm } from '@/components/auth-form';
import { AuthShell } from '@/components/auth-shell';
import { supabaseConfigured } from '@/lib/config';
import { requireUser } from '@/lib/auth';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  return (
    <AuthShell
      title="Choose a new password"
      description="Set a strong, unique password for your account."
    >
      {params.error && (
        <div className="notice danger" role="alert">
          Verification failed or the link has expired. Request a new link and try again.
        </div>
      )}
      <AuthForm mode="update" configured={supabaseConfigured()} />
    </AuthShell>
  );
}
