import { AuthForm } from '@/components/auth-form';
import { AuthShell } from '@/components/auth-shell';
import { supabaseConfigured } from '@/lib/config';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthShell title="Welcome back" description="Sign in to your ministry workspace.">
      {params.error && (
        <div className="notice danger" role="alert">
          Verification failed or the link has expired. Request a new link and try again.
        </div>
      )}
      <AuthForm mode="login" configured={supabaseConfigured()} />
    </AuthShell>
  );
}
