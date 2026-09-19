'use client';
import Link from 'next/link';
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="empty-state panel error-page">
      <h1>We couldn’t complete that request.</h1>
      <p>
        Operation Failed. Your data could not be loaded or the service is unavailable. No
        replacement data has been generated.
      </p>
      <div className="actions">
        <button className="button button-primary" onClick={reset}>
          Try again
        </button>
        <Link className="button button-outline" href="/app">
          Return to workspace
        </Link>
      </div>
      <p className="muted">
        If this continues, ask your administrator to check the database connection and migrations.
      </p>
    </section>
  );
}
