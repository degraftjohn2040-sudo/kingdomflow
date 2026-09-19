import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="empty-state error-page">
      <h1>Record or page not found.</h1>
      <p>It may have moved, or you may not have permission to view it.</p>
      <Link href="/app" className="button button-primary">
        Back to workspace
      </Link>
    </main>
  );
}
